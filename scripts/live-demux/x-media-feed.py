#!/usr/bin/env python3
"""Expand https://x.com/<user>/media into a video status playlist.

yt-dlp only extracts single tweets / broadcasts / spaces — not profile Media tabs.
This helper calls X GraphQL (UserByScreenName + UserMedia) with browser cookies
and prints flat-playlist-compatible JSON lines:

  {"id":"…","title":"…","url":"https://x.com/<user>/status/…","webpage_url":"…"}

Usage:
  python3 scripts/live-demux/x-media-feed.py 'https://x.com/zanelowe/media'
  python3 scripts/live-demux/x-media-feed.py zanelowe --end 40 --videos-only

Env (same as live-demux):
  YTDLP_COOKIES / X_COOKIES                 Netscape cookie file
  YTDLP_COOKIES_FROM_BROWSER / X_COOKIES_FROM_BROWSER   safari|chrome|firefox
  X_GQL_USER_BY_SCREEN / X_GQL_USER_MEDIA   override query ids if X rotates them
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import MozillaCookieJar
from pathlib import Path
from typing import Any, Iterable, Optional

# Bearer token shipped in the X web client (public).
BEARER = (
    "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs"
    "%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
)
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
)

# Observed 2026-07 from abs.twimg.com client-web main.js — overridable via env.
DEFAULT_USER_BY_SCREEN = "Gb-d6r0vxPOADdG62OEBpQ"
DEFAULT_USER_MEDIA = "2DC9TKrcUzwGC_QskSVl5w"

FEATURES: dict[str, bool] = {
    "rweb_video_screen_enabled": False,
    "profile_label_improvements_pcf_label_in_post_enabled": True,
    "responsive_web_graphql_exclude_directive_enabled": True,
    "verified_phone_label_enabled": False,
    "creator_subscriptions_tweet_preview_api_enabled": True,
    "responsive_web_graphql_timeline_navigation_enabled": True,
    "responsive_web_graphql_skip_user_profile_image_extensions_enabled": False,
    "communities_web_enable_tweet_community_results_fetch": True,
    "c9s_tweet_anatomy_moderator_badge_enabled": True,
    "articles_preview_enabled": True,
    "responsive_web_edit_tweet_api_enabled": True,
    "graphql_is_translatable_rweb_tweet_is_translatable_enabled": True,
    "view_counts_everywhere_api_enabled": True,
    "longform_notetweets_consumption_enabled": True,
    "responsive_web_twitter_article_tweet_consumption_enabled": True,
    "tweet_awards_web_tipping_enabled": False,
    "creator_subscriptions_quote_tweet_preview_enabled": False,
    "freedom_of_speech_not_reach_fetch_enabled": True,
    "standardized_nudges_misinfo": True,
    "tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled": True,
    "rweb_video_timestamps_enabled": True,
    "longform_notetweets_rich_text_read_enabled": True,
    "longform_notetweets_inline_media_enabled": True,
    "responsive_web_enhance_cards_enabled": False,
    "rweb_tipjar_consumption_enabled": True,
    "responsive_web_profile_redirect_enabled": False,
    "subscriptions_verification_info_is_identity_verified_enabled": True,
    "subscriptions_verification_info_verified_since_enabled": True,
    "highlights_tweets_tab_ui_enabled": True,
    "responsive_web_twitter_article_notes_tab_enabled": True,
    "subscriptions_feature_can_gift_premium": True,
    "hidden_profile_subscriptions_enabled": True,
    "rweb_cashtags_enabled": False,
}


MEDIA_URL_RE = re.compile(
    r"""(?ix)
    ^(?:https?://)?(?:(?:www|m(?:obile)?)\.)?
    (?:(?:twitter|x)\.com)/
    (?P<user>[A-Za-z0-9_]{1,15})
    /(?P<tab>media|videos|photos|likes)?
    /?
    (?:\?.*)?$
    """
)


def parse_user_media_locator(raw: str) -> Optional[tuple[str, str]]:
    """Return (screen_name, tab) or None if not a profile media-ish URL/handle."""
    s = raw.strip()
    if not s:
        return None
    # Bare @handle or handle → media tab
    if re.fullmatch(r"@?[A-Za-z0-9_]{1,15}", s) and not s.startswith("http"):
        return s.lstrip("@"), "media"
    m = MEDIA_URL_RE.match(s)
    if not m:
        # Also accept …/user without tab as media feed when --force
        m2 = re.match(
            r"(?i)^(?:https?://)?(?:(?:www|m(?:obile)?)\.)?(?:twitter|x)\.com/"
            r"([A-Za-z0-9_]{1,15})/?$",
            s,
        )
        if m2:
            return m2.group(1), "media"
        return None
    user = m.group("user")
    tab = (m.group("tab") or "media").lower()
    if user.lower() in {"i", "home", "explore", "search", "settings", "messages"}:
        return None
    return user, tab


def _cookie_file_candidates() -> list[str]:
    out: list[str] = []
    for key in ("YTDLP_COOKIES", "X_COOKIES"):
        p = os.environ.get(key, "").strip()
        if p and Path(p).is_file():
            out.append(p)
    return out


def _browser_name() -> str:
    for key in ("YTDLP_COOKIES_FROM_BROWSER", "X_COOKIES_FROM_BROWSER"):
        b = os.environ.get(key, "").strip()
        if b:
            return b.split(":")[0]  # safari:Profile → safari
    return "safari"


def load_auth_cookies() -> tuple[str, str]:
    """Return (auth_token, ct0) from netscape file or browser via yt-dlp."""
    for path in _cookie_file_candidates():
        jar = MozillaCookieJar(path)
        try:
            jar.load(ignore_discard=True, ignore_expires=True)
        except Exception:
            continue
        auth = ct0 = None
        for c in jar:
            if c.name == "auth_token":
                auth = c.value
            elif c.name == "ct0":
                ct0 = c.value
        if auth and ct0:
            return auth, ct0

    # Pull from browser using yt-dlp's cookie extractor (same as /watch).
    browser = _browser_name()
    auth = ct0 = None
    try:
        # Prefer yt-dlp's bundled interpreter when installed via Homebrew.
        import importlib.util

        if importlib.util.find_spec("yt_dlp") is None:
            # Walk common cellar paths
            for candidate in (
                Path("/usr/local/Cellar/yt-dlp"),
                Path("/opt/homebrew/Cellar/yt-dlp"),
            ):
                if not candidate.is_dir():
                    continue
                for py in sorted(candidate.glob("*/libexec/bin/python"), reverse=True):
                    # Re-exec under that python once.
                    os.execv(
                        str(py),
                        [str(py), *sys.argv],
                    )
            raise RuntimeError(
                "yt_dlp not importable; set YTDLP_COOKIES=… netscape file "
                "or install yt-dlp"
            )
        from yt_dlp.cookies import extract_cookies_from_browser  # type: ignore

        jar = extract_cookies_from_browser(browser)
        for c in jar:
            dom = c.domain or ""
            if "twitter" not in dom and "x.com" not in dom:
                continue
            if c.name == "auth_token":
                auth = c.value
            elif c.name == "ct0":
                ct0 = c.value
    except Exception as e:
        raise RuntimeError(
            f"could not load X cookies from browser={browser!r}: {e}\n"
            "  set YTDLP_COOKIES=/path/to/cookies.txt  or  "
            "YTDLP_COOKIES_FROM_BROWSER=safari"
        ) from e

    if not auth or not ct0:
        raise RuntimeError(
            f"no auth_token/ct0 in {browser} cookies — log into x.com in that browser"
        )
    return auth, ct0


def gql(
    op_id: str,
    op_name: str,
    variables: dict[str, Any],
    auth: str,
    ct0: str,
    field_toggles: Optional[dict[str, bool]] = None,
) -> dict[str, Any]:
    params: dict[str, str] = {
        "variables": json.dumps(variables, separators=(",", ":")),
        "features": json.dumps(FEATURES, separators=(",", ":")),
    }
    if field_toggles is not None:
        params["fieldToggles"] = json.dumps(field_toggles, separators=(",", ":"))
    url = f"https://x.com/i/api/graphql/{op_id}/{op_name}?" + urllib.parse.urlencode(
        params
    )
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {BEARER}",
            "x-csrf-token": ct0,
            "Cookie": f"auth_token={auth}; ct0={ct0}",
            "User-Agent": UA,
            "x-twitter-auth-type": "OAuth2Session",
            "x-twitter-active-user": "yes",
            "x-twitter-client-language": "en",
            "content-type": "application/json",
            "Referer": "https://x.com/",
            "Accept": "*/*",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "ignore")[:400]
        raise RuntimeError(f"GraphQL {op_name} HTTP {e.code}: {body}") from e


def resolve_user_id(screen_name: str, auth: str, ct0: str) -> tuple[str, str]:
    op = os.environ.get("X_GQL_USER_BY_SCREEN", DEFAULT_USER_BY_SCREEN)
    data = gql(
        op,
        "UserByScreenName",
        {"screen_name": screen_name, "withSafetyModeUserFields": True},
        auth,
        ct0,
        field_toggles={"withAuxiliaryUserLabels": True},
    )
    try:
        result = data["data"]["user"]["result"]
        uid = result["rest_id"]
        legacy = result.get("legacy") or {}
        name = legacy.get("screen_name") or screen_name
        return uid, name
    except Exception as e:
        raise RuntimeError(f"UserByScreenName parse failed for @{screen_name}: {e}") from e


def walk_tweets(obj: Any) -> Iterable[dict[str, Any]]:
    if isinstance(obj, dict):
        leg = obj.get("legacy")
        if (
            isinstance(leg, dict)
            and "rest_id" in obj
            and ("full_text" in leg or "entities" in leg or "extended_entities" in leg)
        ):
            yield obj
        for v in obj.values():
            yield from walk_tweets(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_tweets(v)


def tweet_has_video(tweet: dict[str, Any]) -> bool:
    leg = tweet.get("legacy") or {}
    media = (leg.get("extended_entities") or leg.get("entities") or {}).get("media") or []
    return any(m.get("type") in ("video", "animated_gif") for m in media)


def tweet_title(tweet: dict[str, Any]) -> str:
    leg = tweet.get("legacy") or {}
    text = (leg.get("full_text") or leg.get("text") or tweet.get("rest_id") or "?").replace(
        "\n", " "
    )
    return re.sub(r"\s+", " ", text).strip()[:80]


def fetch_media_entries(
    screen_name: str,
    *,
    end: int = 40,
    videos_only: bool = True,
) -> list[dict[str, str]]:
    auth, ct0 = load_auth_cookies()
    uid, handle = resolve_user_id(screen_name, auth, ct0)
    op = os.environ.get("X_GQL_USER_MEDIA", DEFAULT_USER_MEDIA)
    # Request a bit more than `end` when filtering videos only.
    count = min(100, max(end * 2 if videos_only else end, end))
    data = gql(
        op,
        "UserMedia",
        {
            "userId": uid,
            "count": count,
            "includePromotedContent": False,
            "withClientEventToken": False,
            "withBirdwatchNotes": False,
            "withVoice": True,
            "withV2Timeline": True,
        },
        auth,
        ct0,
        field_toggles={"withArticlePlainText": False},
    )

    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for t in walk_tweets(data):
        rid = str(t.get("rest_id") or "")
        if not rid or rid in seen:
            continue
        if videos_only and not tweet_has_video(t):
            continue
        seen.add(rid)
        page = f"https://x.com/{handle}/status/{rid}"
        out.append(
            {
                "id": rid,
                "title": tweet_title(t),
                "url": page,
                "webpage_url": page,
            }
        )
        if len(out) >= end:
            break
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("locator", help="https://x.com/user/media · @user · user")
    ap.add_argument("--end", type=int, default=int(os.environ.get("LIVE_DEMUX_PLAYLIST_END", "40")))
    ap.add_argument(
        "--all-media",
        action="store_true",
        help="include photos (default: video + gif only)",
    )
    ap.add_argument(
        "--format",
        choices=("jsonl", "tsv", "urls"),
        default="jsonl",
        help="jsonl (default, yt-dlp flat shape) · tsv id|title|url · urls only",
    )
    args = ap.parse_args()

    parsed = parse_user_media_locator(args.locator)
    if not parsed:
        print(f"error: not an X user media locator: {args.locator}", file=sys.stderr)
        return 2
    user, _tab = parsed

    try:
        entries = fetch_media_entries(
            user, end=max(1, args.end), videos_only=not args.all_media
        )
    except Exception as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    if not entries:
        print(f"error: no media entries for @{user}", file=sys.stderr)
        return 1

    for e in entries:
        if args.format == "jsonl":
            print(json.dumps(e, ensure_ascii=False))
        elif args.format == "tsv":
            title = e["title"].replace("|", "/")
            print(f"{e['id']}|{title}|{e['url']}")
        else:
            print(e["url"])
    return 0


if __name__ == "__main__":
    sys.exit(main())

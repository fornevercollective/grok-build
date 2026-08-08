/* Split keyboard · kbatch.ugrad.ai layouts
 * Larger keys · ABC/123/symbols layers · full kbatch+matrix boards
 * VER: drone-split-kb-v3-layouts
 */
(function (global) {
  "use strict";
  var VER = "drone-split-kb-v3-layouts";

  var KBATCH_CORE = ["qwerty","dvorak","colemak","azerty","qwertz","ru","ko","he","ar","hi","el","th","tr","en2"];
  var LAYOUT_ORDER = ["qwerty","dvorak","colemak","azerty","qwertz","ru","ko","he","ar","hi","el","th","tr","workman","bepo","jcuken","ukrainian","bulgarian_bds","korean_dubeol","japanese_jis","arabic","hebrew","chinese_pinyin","armenian","alphabetical","stenotype","fitaly","es","pt","it","pl","sv","nl","uk","bg","vi","id","ja","zh","cs","hu","ro","sr","hr","sl","da","no","fi","ms","querty","qzerty"];
  var LAYOUTS = {"qwerty":{"id":"qwerty","label":"QWERTY","rows":[["Q","W","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L",";"],["Z","X","C","V","B","N","M",",",".","/"]],"family":"latin"},"dvorak":{"id":"dvorak","label":"Dvorak","rows":[["\"",",",".","P","Y","F","G","C","R","L"],["A","O","E","U","I","D","H","T","N","S"],[";","Q","J","K","X","B","M","W","V","Z"]],"family":"ergonomic"},"colemak":{"id":"colemak","label":"Colemak","rows":[["Q","W","F","P","G","J","L","U","Y",";"],["A","R","S","T","D","H","N","E","I","O"],["Z","X","C","V","B","K","M",",",".","/"]],"family":"ergonomic"},"azerty":{"id":"azerty","label":"AZERTY","rows":[["A","Z","E","R","T","Y","U","I","O","P"],["Q","S","D","F","G","H","J","K","L","M"],["W","X","C","V","B","N",",",";",":","!"]],"family":"latin"},"qwertz":{"id":"qwertz","label":"QWERTZ","rows":[["Q","W","E","R","T","Z","U","I","O","P"],["A","S","D","F","G","H","J","K","L","Ö"],["Y","X","C","V","B","N","M",",",".","-"]],"family":"latin"},"ru":{"id":"ru","label":"RU · ЙЦУКЕН","rows":[["Й","Ц","У","К","Е","Н","Г","Ш","Щ","З"],["Ф","Ы","В","А","П","Р","О","Л","Д","Ж"],["Я","Ч","С","М","И","Т","Ь","Б","Ю","."]],"family":"cyrillic"},"ko":{"id":"ko","label":"KO","rows":[["ㅂ","ㅈ","ㄷ","ㄱ","ㅅ","ㅛ","ㅕ","ㅑ","ㅐ","ㅔ"],["ㅁ","ㄴ","ㅇ","ㄹ","ㅎ","ㅗ","ㅓ","ㅏ","ㅣ"],["ㅋ","ㅌ","ㅊ","ㅍ","ㅠ","ㅜ","ㅡ"]],"family":""},"he":{"id":"he","label":"HE · עברית","rows":[["/","\\'","ק","ר","א","ט","ו","ן","ם","פ"],["ש","ד","ג","כ","ע","י","ח","ל","ך","ף"],["ז","ס","ב","ה","נ","מ","צ","ת","ץ","."]],"family":"semitic"},"ar":{"id":"ar","label":"AR · العربية","rows":[["ض","ص","ث","ق","ف","غ","ع","ه","خ","ح"],["ش","س","ي","ب","ل","ا","ت","ن","م","ك"],["ئ","ء","ؤ","ر","لا","ى","ة","و","ز","ظ"]],"family":"semitic"},"hi":{"id":"hi","label":"HI","rows":[["ौ","ै","ा","ी","ू","ब","ह","ग","द","ज","ड"],["ो","े","्","ि","ु","प","र","क","त","च","ट"],["ं","म","न","व","ल","स","य"]],"family":""},"el":{"id":"el","label":"Ελληνικά","rows":[[";","ς","ε","ρ","τ","υ","θ","ι","ο","π"],["α","σ","δ","φ","γ","η","ξ","κ","λ"],["ζ","χ","ψ","ω","β","ν","μ"]],"family":"greek"},"th":{"id":"th","label":"TH","rows":[["ๆ","ไ","ำ","พ","ะ","ั","ี","ร","น","ย","บ","ล"],["ฟ","ห","ก","ด","เ","้","่","า","ส","ว","ง"],["ผ","ป","แ","อ","ิ","ื","ท","ม","ใ","ฝ"]],"family":""},"tr":{"id":"tr","label":"TR","rows":[["q","w","e","r","t","y","u","ı","o","p","ğ","ü"],["a","s","d","f","g","h","j","k","l","ş","i"],["z","x","c","v","b","n","m","ö","ç"]],"family":""},"workman":{"id":"workman","label":"Workman","rows":[["Q","D","R","W","B","J","F","U","P",";"],["A","S","H","T","G","Y","N","E","O","I"],["Z","X","M","C","V","K","L",",",".","/"]],"family":"ergonomic"},"bepo":{"id":"bepo","label":"BÉPO","rows":[["B","É","P","O","È","!","V","D","L","J"],["A","U","I","E","T","S","R","N","M","C"],["À","Y","X",".","K","\\'","Q","G","H","F"]],"family":"ergonomic"},"jcuken":{"id":"jcuken","label":"ЙЦУКЕН","rows":[["Й","Ц","У","К","Е","Н","Г","Ш","Щ","З"],["Ф","Ы","В","А","П","Р","О","Л","Д","Ж"],["Я","Ч","С","М","И","Т","Ь","Б","Ю","."]],"family":"cyrillic"},"ukrainian":{"id":"ukrainian","label":"Українська","rows":[["Й","Ц","У","К","Е","Н","Г","Ш","Щ","З"],["Ф","І","В","А","П","Р","О","Л","Д","Ж"],["Є","Я","Ч","С","М","И","Т","Ь","Б","Ю"]],"family":"cyrillic"},"bulgarian_bds":{"id":"bulgarian_bds","label":"БДС","rows":[["У","Е","И","Ш","Щ","К","С","Д","З","Ц"],["Ь","Я","А","О","Ж","Г","Т","Н","В","М"],["Ю","Й","Ъ","Э","Ф","Х","П","Р","Л","Ч"]],"family":"cyrillic"},"korean_dubeol":{"id":"korean_dubeol","label":"두벌식","rows":[["ㅂ","ㅈ","ㄷ","ㄱ","ㅅ","ㅛ","ㅕ","ㅑ","ㅐ","ㅔ"],["ㅁ","ㄴ","ㅇ","ㄹ","ㅎ","ㅗ","ㅓ","ㅏ","ㅣ",";"],["ㅋ","ㅌ","ㅊ","ㅍ","ㅠ","ㅜ","ㅡ",",",".","/"]],"family":"asian"},"japanese_jis":{"id":"japanese_jis","label":"JIS","rows":[["た","て","い","す","か","ん","な","に","ら","せ"],["ち","と","し","は","き","く","ま","の","り","れ"],["つ","さ","そ","ひ","こ","み","も","ね","る","め"]],"family":"asian"},"arabic":{"id":"arabic","label":"العربية","rows":[["ض","ص","ث","ق","ف","غ","ع","ه","خ","ح"],["ش","س","ي","ب","ل","ا","ت","ن","م","ك"],["ئ","ء","ؤ","ر","لا","ى","ة","و","ز","ظ"]],"family":"semitic"},"hebrew":{"id":"hebrew","label":"עברית","rows":[["/","\\'","ק","ר","א","ט","ו","ן","ם","פ"],["ש","ד","ג","כ","ע","י","ח","ל","ך","ף"],["ז","ס","ב","ה","נ","מ","צ","ת","ץ","."]],"family":"semitic"},"chinese_pinyin":{"id":"chinese_pinyin","label":"拼音","rows":[["Q","W","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L",";"],["Z","X","C","V","B","N","M",",",".","/"]],"family":"asian"},"armenian":{"id":"armenian","label":"Հայերեն","rows":[["Ք","Ո","Ե","Ռ","Տ","Ե","Ւ","Ի","Օ","Պ"],["Ա","Ս","Դ","Ֆ","Գ","Հ","Ջ","Կ","Լ",";"],["Զ","Խ","Ց","Վ","Բ","Ն","Մ",",",".","/"]],"family":"semitic"},"alphabetical":{"id":"alphabetical","label":"ABC","rows":[["A","B","C","D","E","F","G","H","I","J"],["K","L","M","N","O","P","Q","R","S","T"],["U","V","W","X","Y","Z",",",".",";","/"]],"family":"specialized"},"stenotype":{"id":"stenotype","label":"Stenotype","rows":[["S","T","K","P","W","H","R","A","O","*"],["E","U","F","R","P","B","L","G","T","S"],["D","Z","#","S","T","K","P","W","H","R"]],"family":"specialized"},"fitaly":{"id":"fitaly","label":"FITALY","rows":[["Q","W","E","R","Y","T","D","F","G","A"],["U","I","H","J","K","S","C","V","P","L"],["M","X","O","B","Z","N",",",".","?","!"]],"family":"specialized"},"es":{"id":"es","label":"ES","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l","ñ"],["z","x","c","v","b","n","m"]],"family":""},"pt":{"id":"pt","label":"PT","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l","ç"],["z","x","c","v","b","n","m"]],"family":""},"it":{"id":"it","label":"IT","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["z","x","c","v","b","n","m"]],"family":""},"pl":{"id":"pl","label":"PL","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l","ł"],["z","x","c","v","b","n","m"]],"family":""},"sv":{"id":"sv","label":"SV","rows":[["q","w","e","r","t","y","u","i","o","p","å"],["a","s","d","f","g","h","j","k","l","ö","ä"],["z","x","c","v","b","n","m"]],"family":""},"nl":{"id":"nl","label":"NL","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["z","x","c","v","b","n","m"]],"family":""},"uk":{"id":"uk","label":"UK","rows":[["й","ц","у","к","е","н","г","ш","щ","з","х"],["ф","і","в","а","п","р","о","л","д","ж","є"],["я","ч","с","м","и","т","ь","б","ю"]],"family":""},"bg":{"id":"bg","label":"BG","rows":[["я","в","е","р","т","ъ","у","и","о","п","ш","щ"],["а","с","д","ф","г","х","й","к","л","ю"],["з","ь","ц","ж","б","н","м"]],"family":""},"vi":{"id":"vi","label":"VI","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["z","x","c","v","b","n","m"]],"family":""},"id":{"id":"id","label":"ID","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["z","x","c","v","b","n","m"]],"family":""},"ja":{"id":"ja","label":"JA","rows":[["ぬ","ふ","あ","う","え","お","や","ゆ","よ","わ"],["た","て","い","す","か","ん","な","に","ら","せ"],["ち","と","し","は","き","く","ま","の","り","れ"]],"family":""},"zh":{"id":"zh","label":"ZH-Pinyin","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["z","x","c","v","b","n","m"]],"family":""},"cs":{"id":"cs","label":"CS","rows":[["q","w","e","r","t","z","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["y","x","c","v","b","n","m"]],"family":""},"hu":{"id":"hu","label":"HU","rows":[["q","w","e","r","t","z","u","i","o","p"],["a","s","d","f","g","h","j","k","l","é","á"],["í","y","x","c","v","b","n","m","ö","ü","ó"]],"family":""},"ro":{"id":"ro","label":"RO","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["z","x","c","v","b","n","m"]],"family":""},"sr":{"id":"sr","label":"SR","rows":[["љ","њ","е","р","т","з","у","и","о","п","ш"],["а","с","д","ф","г","х","ј","к","л","ч","ћ"],["ѕ","џ","ц","в","б","н","м","ж"]],"family":""},"hr":{"id":"hr","label":"HR","rows":[["q","w","e","r","t","z","u","i","o","p","š","đ"],["a","s","d","f","g","h","j","k","l","č","ć"],["<","y","x","c","v","b","n","m",",",".","-"]],"family":""},"sl":{"id":"sl","label":"SL","rows":[["q","w","e","r","t","z","u","i","o","p","š","đ"],["a","s","d","f","g","h","j","k","l","č","ć"],["<","y","x","c","v","b","n","m",",",".","-"]],"family":""},"da":{"id":"da","label":"DA","rows":[["q","w","e","r","t","y","u","i","o","p","å"],["a","s","d","f","g","h","j","k","l","æ","ø"],["z","x","c","v","b","n","m"]],"family":""},"no":{"id":"no","label":"NO","rows":[["q","w","e","r","t","y","u","i","o","p","å"],["a","s","d","f","g","h","j","k","l","ø","æ"],["z","x","c","v","b","n","m"]],"family":""},"fi":{"id":"fi","label":"FI","rows":[["q","w","e","r","t","y","u","i","o","p","å"],["a","s","d","f","g","h","j","k","l","ö","ä"],["z","x","c","v","b","n","m"]],"family":""},"ms":{"id":"ms","label":"MS","rows":[["q","w","e","r","t","y","u","i","o","p"],["a","s","d","f","g","h","j","k","l"],["z","x","c","v","b","n","m"]],"family":""},"querty":{"id":"querty","label":"QÜERTY","rows":[["Q","Ü","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L",";"],["Z","X","C","V","B","N","M",",",".","/"]],"family":"latin"},"qzerty":{"id":"qzerty","label":"QZERTY","rows":[["Q","Z","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L","M"],["W","X","C","V","B","N",",",";",":","."]],"family":"latin"}};

  var NUM = {
    left: [["1","2","3","4","5"],["-","/",":",";","("],[".",",","?","!","'"]],
    right: [["6","7","8","9","0"],[")","$","&","@","\""],["#","%","^","*","+"]]
  };
  var SYM = {
    left: [["[","]","{","}","#"],["_","\\","|","~","<"],[".",",","?","!","'"]],
    right: [["%","^","*","+","="],[">","€","£","¥","·"],["\"","`","°","…","/"]]
  };

  var buf = "";
  var shift = false;
  var layer = "abc"; // abc | num | sym
  var layoutId = "qwerty";
  var listeners = [];
  var roots = [];
  var bufEls = [];
  var bodyHosts = { left: null, right: null };
  var layoutSel = null;
  var layerBtns = [];
  var visible = true;
  var storageKey = "drone-split-kb-layout";

  try {
    var saved = localStorage.getItem(storageKey);
    if (saved && LAYOUTS[saved]) layoutId = saved;
  } catch (e0) {}

  function emit(type, data) {
    listeners.forEach(function (fn) {
      try { fn({ type: type, data: data, buf: buf, layout: layoutId, layer: layer }); } catch (e) {}
    });
  }

  function isLetterish(ch) {
    return ch && ch.length === 1 && /[A-Za-zÀ-ÖØ-öø-ÿΑ-ωА-яЁё]/.test(ch);
  }

  function push(ch) {
    ch = String(ch == null ? "" : ch);
    if (!ch) return;
    if (shift && layer === "abc" && ch.length === 1) {
      try {
        var up = ch.toLocaleUpperCase();
        var lo = ch.toLocaleLowerCase();
        if (up !== lo) ch = (ch === lo) ? up : lo;
      } catch (eCase) {
        ch = ch.toUpperCase();
      }
      shift = false;
      paintShift();
    }
    buf += ch;
    syncBuf();
    emit("type", ch);
  }

  function backspace() {
    if (!buf.length) return;
    buf = buf.slice(0, -1);
    syncBuf();
    emit("backspace", null);
  }

  function enter() {
    var line = buf;
    emit("enter", line);
    try {
      if (global.WebgridDroneHud && WebgridDroneHud.hotpipe) {
        if (line.charAt(0) === "{") {
          try { WebgridDroneHud.hotpipe.ingest(JSON.parse(line)); } catch (e1) {}
        }
      }
      if (typeof global.log === "function") global.log("kb · " + (line || "↵"), "ev");
    } catch (e) {}
    buf = "";
    syncBuf();
  }

  function syncBuf() {
    var t = buf || ("type · " + layoutId + " · " + layer + " · ↵ send · ` capture");
    bufEls.forEach(function (el) {
      if (el) el.textContent = t;
    });
  }

  function paintShift() {
    roots.forEach(function (r) {
      if (r.el) r.el.classList.toggle("shift-on", shift);
    });
    updateLetterLabels();
  }

  function updateLetterLabels() {
    if (layer !== "abc") return;
    document.querySelectorAll(".drone-split-kb .skb-key.letter").forEach(function (b) {
      var base = b.getAttribute("data-base") || b.textContent;
      b.setAttribute("data-base", base);
      if (shift) {
        try { b.textContent = base.toLocaleUpperCase(); } catch (e) { b.textContent = base.toUpperCase(); }
      } else {
        try {
          // keep original casing from data-base
          b.textContent = base;
        } catch (e2) {}
      }
    });
  }

  function paintLayerState() {
    roots.forEach(function (r) {
      if (r.el) {
        r.el.setAttribute("data-layer", layer);
        r.el.setAttribute("data-layout", layoutId);
      }
    });
    layerBtns.forEach(function (b) {
      if (!b) return;
      var id = b.getAttribute("data-layer-btn");
      b.classList.toggle("on", id === layer);
      // label swap button shows next action
      if (id === "swap") {
        b.textContent = layer === "abc" ? "123" : layer === "num" ? "#+=" : "ABC";
      }
    });
  }

  function keyBtn(label, cls, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "skb-key" + (cls ? " " + cls : "");
    b.textContent = label;
    b.title = label;
    b.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      fn();
      b.classList.add("hit");
      setTimeout(function () { b.classList.remove("hit"); }, 90);
    });
    return b;
  }

  function splitRows(rows) {
    var L = [], R = [];
    (rows || []).forEach(function (row) {
      var n = row.length;
      var mid = Math.ceil(n / 2);
      L.push(row.slice(0, mid));
      R.push(row.slice(mid));
    });
    return { left: L, right: R };
  }

  function currentHalves() {
    if (layer === "num") return NUM;
    if (layer === "sym") return SYM;
    var def = LAYOUTS[layoutId] || LAYOUTS.qwerty;
    var rows = (def && def.rows) || LAYOUTS.qwerty.rows;
    // ensure 3 letter rows; if only 3, fine. if more, take last 3 alpha-like
    var use = rows;
    if (rows.length > 3) use = rows.slice(rows.length - 3);
    // lowercase display for latin boards for shift UX
    var norm = use.map(function (row) {
      return row.map(function (k) {
        if (typeof k === "string" && k.length === 1 && k >= "A" && k <= "Z") return k.toLowerCase();
        return String(k);
      });
    });
    return splitRows(norm);
  }

  function paintHalf(side) {
    var wrap = document.createElement("div");
    wrap.className = "skb-half skb-" + side;
    wrap.setAttribute("data-side", side);
    var halves = currentHalves();
    var rows = halves[side] || [];
    rows.forEach(function (row, ri) {
      var rowEl = document.createElement("div");
      rowEl.className = "skb-row" + (ri === 1 ? " home" : "") + (ri === 2 ? " bottom" : "");
      row.forEach(function (k) {
        var label = k;
        if (shift && layer === "abc") {
          try { label = String(k).toLocaleUpperCase(); } catch (eL) { label = String(k).toUpperCase(); }
        }
        var btn = keyBtn(label, "letter", function () { push(k); });
        btn.setAttribute("data-base", k);
        rowEl.appendChild(btn);
      });
      wrap.appendChild(rowEl);
    });
    return wrap;
  }

  function cycleLayer() {
    if (layer === "abc") layer = "num";
    else if (layer === "num") layer = "sym";
    else layer = "abc";
    shift = false;
    paintShift();
    repaintKeys();
    emit("layer", layer);
  }

  function setLayer(id) {
    if (id !== "abc" && id !== "num" && id !== "sym") return;
    layer = id;
    shift = false;
    paintShift();
    repaintKeys();
    emit("layer", layer);
  }

  function paintMods(side) {
    var mid = document.createElement("div");
    mid.className = "skb-mods";
    // layer swap 123 / #+= / ABC
    var swap = keyBtn(layer === "abc" ? "123" : layer === "num" ? "#+=" : "ABC", "mod swap", cycleLayer);
    swap.setAttribute("data-layer-btn", "swap");
    layerBtns.push(swap);
    mid.appendChild(swap);

    mid.appendChild(keyBtn("⇧", "mod shift", function () {
      if (layer !== "abc") {
        // from num/sym, shift often toggles num<->sym like iOS
        setLayer(layer === "num" ? "sym" : "num");
        return;
      }
      shift = !shift;
      paintShift();
      repaintKeys();
    }));
    mid.appendChild(keyBtn("spc", "space", function () { push(" "); }));
    mid.appendChild(keyBtn("⌫", "mod", function () { backspace(); }));
    mid.appendChild(keyBtn("↵", "mod enter", function () { enter(); }));
    if (side === "right") {
      mid.appendChild(keyBtn("esc", "mod", function () {
        buf = "";
        syncBuf();
        emit("esc", null);
        try {
          if (global.WebgridDroneHud && WebgridDroneHud.arm)
            global.WebgridDroneHud.arm(false);
        } catch (e) {}
      }));
    } else {
      mid.appendChild(keyBtn("ABC", "mod", function () { setLayer("abc"); }));
    }
    return mid;
  }

  function fillBody(side, host) {
    if (!host) return;
    host.innerHTML = "";
    if (side === "left") {
      host.appendChild(paintHalf("left"));
      host.appendChild(paintMods("left"));
    } else {
      host.appendChild(paintMods("right"));
      host.appendChild(paintHalf("right"));
    }
  }

  function repaintKeys() {
    layerBtns = [];
    fillBody("left", bodyHosts.left);
    fillBody("right", bodyHosts.right);
    paintLayerState();
    paintShift();
    // re-collect layer buttons already done in paintMods
    paintLayerState();
    syncBuf();
  }

  function setLayout(id) {
    if (!LAYOUTS[id]) return false;
    layoutId = id;
    layer = "abc";
    shift = false;
    try { localStorage.setItem(storageKey, id); } catch (e) {}
    if (layoutSel) layoutSel.value = id;
    repaintKeys();
    emit("layout", id);
    return true;
  }

  function buildLayoutSelect() {
    var sel = document.createElement("select");
    sel.className = "skb-layout-sel";
    sel.title = "kbatch layout";
    // group: kbatch core
    var g1 = document.createElement("optgroup");
    g1.label = "kbatch · core 15";
    KBATCH_CORE.forEach(function (id) {
      if (!LAYOUTS[id]) return;
      var o = document.createElement("option");
      o.value = id;
      o.textContent = (LAYOUTS[id].label || id) + " · " + id;
      g1.appendChild(o);
    });
    sel.appendChild(g1);
    var g2 = document.createElement("optgroup");
    g2.label = "all boards";
    LAYOUT_ORDER.forEach(function (id) {
      if (!LAYOUTS[id]) return;
      if (KBATCH_CORE.indexOf(id) >= 0) return;
      var o = document.createElement("option");
      o.value = id;
      o.textContent = (LAYOUTS[id].label || id) + " · " + id;
      g2.appendChild(o);
    });
    sel.appendChild(g2);
    sel.value = layoutId;
    sel.addEventListener("change", function () {
      setLayout(sel.value);
    });
    // don't steal WASD while using select? select is fine
    sel.addEventListener("keydown", function (e) { e.stopPropagation(); });
    return sel;
  }

  function mountColumns(leftHost, rightHost) {
    ensureCss();
    roots = [];
    bufEls = [];
    bodyHosts = { left: null, right: null };
    layerBtns = [];

    if (leftHost) {
      leftHost.innerHTML = "";
      var L = document.createElement("div");
      L.className = "drone-split-kb skb-col skb-col-l";
      L.innerHTML =
        '<div class="skb-top">' +
        '  <span class="skb-brand">L · <b>kbatch</b></span>' +
        '  <span class="skb-buf"></span>' +
        "</div>" +
        '<div class="skb-body-col"></div>';
      leftHost.appendChild(L);
      bodyHosts.left = L.querySelector(".skb-body-col");
      roots.push({ el: L, side: "left" });
      bufEls.push(L.querySelector(".skb-buf"));
    }
    if (rightHost) {
      rightHost.innerHTML = "";
      var R = document.createElement("div");
      R.className = "drone-split-kb skb-col skb-col-r";
      R.innerHTML =
        '<div class="skb-top">' +
        '  <span class="skb-brand">R · <b>kbatch</b></span>' +
        '  <span class="skb-buf"></span>' +
        '  <a class="skb-link" href="https://kbatch.ugrad.ai/" target="_blank" rel="noopener">↗</a>' +
        '  <button type="button" class="skb-toggle" title="Hide">▾</button>' +
        "</div>" +
        '<div class="skb-body-col"></div>';
      rightHost.appendChild(R);
      bodyHosts.right = R.querySelector(".skb-body-col");
      roots.push({ el: R, side: "right" });
      bufEls.push(R.querySelector(".skb-buf"));
      var hide = R.querySelector(".skb-toggle");
      if (hide) hide.onclick = function () { setVisible(!visible); };
      // layout select on right top
      layoutSel = buildLayoutSelect();
      var top = R.querySelector(".skb-top");
      if (top) top.insertBefore(layoutSel, top.querySelector(".skb-link") || null);
    } else if (leftHost) {
      layoutSel = buildLayoutSelect();
      var topL = leftHost.querySelector(".skb-top");
      if (topL) topL.appendChild(layoutSel);
    }

    repaintKeys();
    window.addEventListener("keydown", onKey);
    return roots;
  }

  function onKey(e) {
    if (!visible) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT")) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var capturing = roots.some(function (r) {
      return r.el && r.el.classList.contains("capture");
    });
    if (!capturing && !buf.length) {
      if (e.key === "`") {
        e.preventDefault();
        roots.forEach(function (r) {
          if (r.el) r.el.classList.toggle("capture");
        });
        syncBuf();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      buf = "";
      syncBuf();
      roots.forEach(function (r) {
        if (r.el) r.el.classList.remove("capture");
      });
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      backspace();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      enter();
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      push(e.key);
    }
  }

  function setVisible(on) {
    visible = !!on;
    roots.forEach(function (r) {
      if (r.el) r.el.classList.toggle("hidden", !visible);
    });
    document.querySelectorAll(".skb-host").forEach(function (h) {
      h.classList.toggle("hidden", !visible);
    });
    emit("visibility", visible);
  }

  function ensureCss() {
    var existing = document.getElementById("drone-split-kb-css");
    if (existing) existing.remove();
    var st = document.createElement("style");
    st.id = "drone-split-kb-css";
    st.textContent = [
      "/* column split KB — large keys · layers · layouts */",
      ".skb-host{flex:1 1 auto;z-index:5;border-top:1px solid rgba(120,200,255,.16);",
      "  background:linear-gradient(180deg,rgba(6,10,18,.98),rgba(2,4,10,.99));",
      "  min-height:0;max-height:58%;overflow:auto}",
      ".skb-host.hidden,.drone-split-kb.hidden{display:none!important}",
      ".drone-split-kb.skb-col{padding:6px 8px 8px;font:600 13px/1 -apple-system,system-ui,sans-serif;height:100%;display:flex;flex-direction:column;min-height:0}",
      ".drone-split-kb.capture{box-shadow:inset 0 1px 0 rgba(10,132,255,.35)}",
      ".skb-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;flex:0 0 auto;",
      "  font:600 9px/1 ui-monospace,Menlo,monospace;letter-spacing:.05em;color:rgba(180,200,220,.5)}",
      ".skb-brand b{color:#7ad0ff}",
      ".skb-buf{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;",
      "  color:rgba(200,230,255,.7);font-size:11px;letter-spacing:0}",
      ".skb-link{color:#7ad0ff;text-decoration:none;flex:0 0 auto}",
      ".skb-toggle{appearance:none;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);",
      "  color:rgba(255,255,255,.7);border-radius:8px;min-height:28px;min-width:28px;padding:2px 6px;cursor:pointer}",
      ".skb-layout-sel{appearance:none;max-width:118px;min-height:28px;padding:2px 6px;",
      "  border-radius:8px;border:1px solid rgba(120,200,255,.28);background:rgba(0,0,0,.45);",
      "  color:rgba(200,230,255,.9);font:600 10px/1 ui-monospace,Menlo,monospace;cursor:pointer}",
      ".skb-layout-sel:focus{outline:none;border-color:rgba(110,200,255,.55)}",
      ".skb-body-col{display:flex;flex-direction:column;gap:8px;align-items:stretch;flex:1 1 auto;min-height:0;justify-content:flex-end}",
      ".skb-half{display:flex;flex-direction:column;gap:6px;width:100%;flex:1 1 auto;justify-content:flex-end}",
      ".skb-row{display:flex;gap:6px;justify-content:center;flex:1 1 auto;min-height:0}",
      ".skb-row.home .skb-key{box-shadow:inset 0 0 0 1px rgba(120,220,160,.32)}",
      ".skb-key{",
      "  appearance:none;border:1px solid rgba(255,255,255,.14);",
      "  background:rgba(40,46,56,.88);color:rgba(244,246,250,.98);",
      "  font:700 16px/1 -apple-system,system-ui,sans-serif;",
      "  flex:1 1 0;min-width:0;min-height:44px;height:100%;max-height:56px;padding:0 4px;border-radius:12px;cursor:pointer;",
      "  box-shadow:inset 0 .5px 0 rgba(255,255,255,.14),0 3px 10px rgba(0,0,0,.3);",
      "  transition:background .08s,transform .06s;touch-action:manipulation}",
      ".skb-key.letter{font-size:18px;letter-spacing:.02em}",
      ".skb-key:hover{background:rgba(255,255,255,.16)}",
      ".skb-key.hit,.skb-key:active{transform:scale(.95);background:rgba(10,132,255,.34)}",
      ".skb-mods{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;flex:0 0 auto}",
      ".skb-mods .skb-key{min-height:40px;max-height:48px;font-size:13px;font-weight:700}",
      ".skb-key.space{background:rgba(10,132,255,.16);border-color:rgba(10,132,255,.36);letter-spacing:.06em}",
      ".skb-key.enter{background:rgba(48,209,88,.18);border-color:rgba(48,209,88,.4)}",
      ".skb-key.swap,.skb-key.mod.swap{background:rgba(180,140,255,.16);border-color:rgba(180,140,255,.4);color:#e0d0ff}",
      ".skb-key.swap.on,.skb-key.mod.on{box-shadow:inset 0 0 0 1px rgba(180,140,255,.5)}",
      ".drone-split-kb.shift-on .skb-key.shift{background:rgba(255,190,50,.28);border-color:rgba(255,190,50,.5)}",
      ".drone-split-kb[data-layer='num'] .skb-key.letter,",
      ".drone-split-kb[data-layer='sym'] .skb-key.letter{font-size:15px}",
      "@media (max-height:700px){.skb-key{min-height:38px;max-height:48px;font-size:15px}.skb-key.letter{font-size:16px}.skb-mods .skb-key{min-height:34px}}",
    ].join("");
    (document.head || document.documentElement).appendChild(st);
  }

  // merge live atlas if present (optional)
  function absorbAtlas() {
    try {
      var A = global.__mgKeyboardAtlas;
      if (!A || !A.layouts) return;
      Object.keys(A.layouts).forEach(function (id) {
        var L = A.layouts[id];
        if (!L || !L.rows) return;
        if (!LAYOUTS[id]) {
          LAYOUTS[id] = { id: id, label: L.label || id, rows: L.rows, family: L.family || "" };
          if (LAYOUT_ORDER.indexOf(id) < 0) LAYOUT_ORDER.push(id);
        }
      });
    } catch (e) {}
  }
  absorbAtlas();

  global.DroneSplitKb = {
    version: VER,
    mount: function (host) { return mountColumns(host, null); },
    mountColumns: mountColumns,
    setVisible: setVisible,
    setLayout: setLayout,
    setLayer: setLayer,
    getLayout: function () { return layoutId; },
    getLayer: function () { return layer; },
    listLayouts: function () {
      return LAYOUT_ORDER.filter(function (id) { return !!LAYOUTS[id]; }).map(function (id) {
        return { id: id, label: LAYOUTS[id].label || id, family: LAYOUTS[id].family || "", core: KBATCH_CORE.indexOf(id) >= 0 };
      });
    },
    on: function (fn) { listeners.push(fn); },
    getBuffer: function () { return buf; },
    clear: function () { buf = ""; syncBuf(); },
  };
})(typeof window !== "undefined" ? window : globalThis);

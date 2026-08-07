# Panda · three MG dispatch panes in one instance

From **grok-build root**:

```bash
cd /Volumes/qbitOS/00.dev/projects/grok-build
./scripts/mg-fleet.sh panda
```

Creates panda session `mg-fleet` with **3 panes** (splits=2):

| Pane | Role | Behavior |
|------|------|----------|
| 1 | **MONITOR** | `mg-fleet monitor start` + tail alive.log |
| 2 | **RUN** | continuous growth (ugrad pack) + tail run.log |
| 3 | **HANDS** | interactive `mgd` / dispatch |

Shell: `~/.panda/fleet-shell-mg.sh`  
Roles auto-assigned via flock (first free of MONITOR/RUN/HANDS).

## Rebuild / reopen

```bash
MG_PANDA_FRESH=1 ./scripts/mg-fleet.sh panda
# or name:
./scripts/mg-fleet.sh panda my-fleet 2
```

## Detach / reattach

```bash
panda list
panda attach mg-fleet
```

## Stop background daemons without killing MG

```bash
./scripts/mg-fleet.sh run stop
./scripts/mg-fleet.sh monitor stop
panda kill mg-fleet
```

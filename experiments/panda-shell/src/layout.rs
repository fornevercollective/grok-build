//! Binary space-partition tree for multi-pane layout (tmux-style splits).

use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PaneId(pub u64);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SplitDir {
    Horizontal, // side-by-side (vertical bar between)
    Vertical,   // stacked (horizontal bar between)
}

#[derive(Debug, Clone)]
pub enum Node {
    Leaf { id: PaneId },
    Split {
        dir: SplitDir,
        /// Fraction of space for the first child (0.05..0.95).
        ratio: f32,
        first: Box<Node>,
        second: Box<Node>,
    },
}

#[derive(Debug, Clone, Copy)]
pub struct Rect {
    pub x: u16,
    pub y: u16,
    pub w: u16,
    pub h: u16,
}

impl Node {
    pub fn leaf(id: PaneId) -> Self {
        Self::Leaf { id }
    }

    pub fn collect_leaves(&self, out: &mut Vec<PaneId>) {
        match self {
            Self::Leaf { id } => out.push(*id),
            Self::Split { first, second, .. } => {
                first.collect_leaves(out);
                second.collect_leaves(out);
            }
        }
    }

    /// Layout the tree into a map of pane id → screen rect.
    pub fn layout(&self, area: Rect, out: &mut HashMap<PaneId, Rect>) {
        match self {
            Self::Leaf { id } => {
                out.insert(*id, area);
            }
            Self::Split {
                dir,
                ratio,
                first,
                second,
            } => {
                // Degenerate areas: give the whole region to the first child.
                if area.w < 2 || area.h < 2 {
                    first.layout(area, out);
                    second.layout(
                        Rect {
                            x: area.x,
                            y: area.y,
                            w: 0,
                            h: 0,
                        },
                        out,
                    );
                    return;
                }
                let ratio = ratio.clamp(0.1, 0.9);
                match dir {
                    SplitDir::Horizontal => {
                        let max_first = area.w.saturating_sub(1).max(1);
                        let left_w = ((area.w as f32) * ratio).round() as u16;
                        let left_w = left_w.clamp(1, max_first);
                        let right_w = area.w.saturating_sub(left_w);
                        first.layout(
                            Rect {
                                x: area.x,
                                y: area.y,
                                w: left_w,
                                h: area.h,
                            },
                            out,
                        );
                        second.layout(
                            Rect {
                                x: area.x.saturating_add(left_w),
                                y: area.y,
                                w: right_w,
                                h: area.h,
                            },
                            out,
                        );
                    }
                    SplitDir::Vertical => {
                        let max_first = area.h.saturating_sub(1).max(1);
                        let top_h = ((area.h as f32) * ratio).round() as u16;
                        let top_h = top_h.clamp(1, max_first);
                        let bot_h = area.h.saturating_sub(top_h);
                        first.layout(
                            Rect {
                                x: area.x,
                                y: area.y,
                                w: area.w,
                                h: top_h,
                            },
                            out,
                        );
                        second.layout(
                            Rect {
                                x: area.x,
                                y: area.y.saturating_add(top_h),
                                w: area.w,
                                h: bot_h,
                            },
                            out,
                        );
                    }
                }
            }
        }
    }

    /// Split the leaf `target` into two leaves; returns the new pane id slot
    /// (caller creates the session). `new_id` becomes the second child.
    pub fn split_leaf(&mut self, target: PaneId, dir: SplitDir, new_id: PaneId) -> bool {
        match self {
            Self::Leaf { id } if *id == target => {
                *self = Self::Split {
                    dir,
                    ratio: 0.5,
                    first: Box::new(Self::Leaf { id: target }),
                    second: Box::new(Self::Leaf { id: new_id }),
                };
                true
            }
            Self::Leaf { .. } => false,
            Self::Split { first, second, .. } => {
                first.split_leaf(target, dir, new_id) || second.split_leaf(target, dir, new_id)
            }
        }
    }

    /// Remove a leaf. If a split becomes a single child, collapse it.
    /// Returns false if this is the last remaining leaf.
    pub fn remove_leaf(&mut self, target: PaneId) -> RemoveResult {
        match self {
            Self::Leaf { id } => {
                if *id == target {
                    RemoveResult::RemovedEmpty
                } else {
                    RemoveResult::NotFound
                }
            }
            Self::Split { first, second, .. } => {
                match first.remove_leaf(target) {
                    RemoveResult::RemovedEmpty => {
                        // first gone → promote second
                        let promoted = std::mem::replace(
                            second.as_mut(),
                            Node::Leaf {
                                id: PaneId(0),
                            },
                        );
                        *self = promoted;
                        return RemoveResult::Removed;
                    }
                    RemoveResult::Removed => return RemoveResult::Removed,
                    RemoveResult::NotFound => {}
                }
                match second.remove_leaf(target) {
                    RemoveResult::RemovedEmpty => {
                        let promoted = std::mem::replace(
                            first.as_mut(),
                            Node::Leaf {
                                id: PaneId(0),
                            },
                        );
                        *self = promoted;
                        RemoveResult::Removed
                    }
                    other => other,
                }
            }
        }
    }

    /// Next/prev leaf in DFS order from `current`.
    pub fn cycle(&self, current: PaneId, forward: bool) -> PaneId {
        let mut leaves = Vec::new();
        self.collect_leaves(&mut leaves);
        if leaves.is_empty() {
            return current;
        }
        let idx = leaves.iter().position(|id| *id == current).unwrap_or(0);
        let next = if forward {
            (idx + 1) % leaves.len()
        } else {
            (idx + leaves.len() - 1) % leaves.len()
        };
        leaves[next]
    }

    /// Neighbor in a cardinal direction from `current`, by geometry.
    pub fn neighbor(
        &self,
        current: PaneId,
        area: Rect,
        dir: FocusDir,
    ) -> Option<PaneId> {
        let mut map = HashMap::new();
        self.layout(area, &mut map);
        let cur = *map.get(&current)?;
        let cx = cur.x as i32 + cur.w as i32 / 2;
        let cy = cur.y as i32 + cur.h as i32 / 2;

        let mut best: Option<(PaneId, i32)> = None;
        for (id, r) in &map {
            if *id == current {
                continue;
            }
            let ox = r.x as i32 + r.w as i32 / 2;
            let oy = r.y as i32 + r.h as i32 / 2;
            let (dx, dy) = (ox - cx, oy - cy);
            let ok = match dir {
                FocusDir::Left => dx < 0 && dy.abs() <= dx.abs() + (r.h as i32),
                FocusDir::Right => dx > 0 && dy.abs() <= dx.abs() + (r.h as i32),
                FocusDir::Up => dy < 0 && dx.abs() <= dy.abs() + (r.w as i32),
                FocusDir::Down => dy > 0 && dx.abs() <= dy.abs() + (r.w as i32),
            };
            if !ok {
                continue;
            }
            let dist = dx * dx + dy * dy;
            if best.map(|(_, d)| dist < d).unwrap_or(true) {
                best = Some((*id, dist));
            }
        }
        best.map(|(id, _)| id)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RemoveResult {
    Removed,
    RemovedEmpty,
    NotFound,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FocusDir {
    Left,
    Right,
    Up,
    Down,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn split_and_layout() {
        let mut root = Node::leaf(PaneId(1));
        assert!(root.split_leaf(PaneId(1), SplitDir::Horizontal, PaneId(2)));
        let mut map = HashMap::new();
        root.layout(
            Rect {
                x: 0,
                y: 0,
                w: 100,
                h: 40,
            },
            &mut map,
        );
        assert_eq!(map.len(), 2);
        assert_eq!(map[&PaneId(1)].w + map[&PaneId(2)].w, 100);
    }

    #[test]
    fn remove_collapses() {
        let mut root = Node::leaf(PaneId(1));
        root.split_leaf(PaneId(1), SplitDir::Vertical, PaneId(2));
        assert!(matches!(root.remove_leaf(PaneId(2)), RemoveResult::Removed));
        match root {
            Node::Leaf { id } => assert_eq!(id, PaneId(1)),
            _ => panic!("expected leaf"),
        }
    }
}

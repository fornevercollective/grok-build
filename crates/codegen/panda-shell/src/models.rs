//! Model routing strip — selectable model chips for pane routing.

use serde::{Deserialize, Serialize};

use crate::protocol::ModelChip;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelEntry {
    pub id: String,
    pub label: String,
    /// Where work is expected to run: metal | cpu | cloud | local.
    pub backend: String,
    pub description: String,
}

#[derive(Debug, Clone)]
pub struct ModelRouter {
    pub models: Vec<ModelEntry>,
    pub active: usize,
}

impl Default for ModelRouter {
    fn default() -> Self {
        Self::load()
    }
}

impl ModelRouter {
    pub fn load() -> Self {
        let models = if let Ok(raw) = std::env::var("PANDA_MODELS") {
            parse_env_models(&raw)
        } else {
            default_catalog()
        };
        Self { models, active: 0 }
    }

    pub fn active(&self) -> &ModelEntry {
        &self.models[self.active.min(self.models.len().saturating_sub(1))]
    }

    pub fn next(&mut self) {
        if !self.models.is_empty() {
            self.active = (self.active + 1) % self.models.len();
        }
    }

    pub fn prev(&mut self) {
        if !self.models.is_empty() {
            self.active = (self.active + self.models.len() - 1) % self.models.len();
        }
    }

    pub fn select(&mut self, idx: usize) -> bool {
        if idx < self.models.len() {
            self.active = idx;
            true
        } else {
            false
        }
    }

    pub fn chips(&self) -> Vec<ModelChip> {
        self.models
            .iter()
            .map(|m| ModelChip {
                id: m.id.clone(),
                label: m.label.clone(),
                backend: m.backend.clone(),
            })
            .collect()
    }

    /// Env export for child shells so tools can see the routed model.
    pub fn env_pairs(&self) -> Vec<(String, String)> {
        let m = self.active();
        vec![
            ("PANDA_MODEL".into(), m.id.clone()),
            ("PANDA_MODEL_LABEL".into(), m.label.clone()),
            ("PANDA_MODEL_BACKEND".into(), m.backend.clone()),
            // Common aliases for agent CLIs.
            ("GROK_MODEL".into(), m.id.clone()),
            ("AI_MODEL".into(), m.id.clone()),
        ]
    }
}

fn default_catalog() -> Vec<ModelEntry> {
    vec![
        ModelEntry {
            id: "grok-build".into(),
            label: "Grok Build".into(),
            backend: "cloud".into(),
            description: "Primary coding agent".into(),
        },
        ModelEntry {
            id: "grok-4".into(),
            label: "Grok 4".into(),
            backend: "cloud".into(),
            description: "Frontier reasoning".into(),
        },
        ModelEntry {
            id: "local-metal".into(),
            label: "Local Metal".into(),
            backend: "metal".into(),
            description: "On-device via Apple Metal / MLX".into(),
        },
        ModelEntry {
            id: "local-cpu".into(),
            label: "Local CPU".into(),
            backend: "cpu".into(),
            description: "CPU inference fallback".into(),
        },
        ModelEntry {
            id: "jax-gpu".into(),
            label: "JAX GPU".into(),
            backend: "gpu".into(),
            description: "JAX workloads on GPU".into(),
        },
    ]
}

/// `id:label:backend,id2:label2:backend2`
fn parse_env_models(raw: &str) -> Vec<ModelEntry> {
    let mut out = Vec::new();
    for part in raw.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let bits: Vec<_> = part.split(':').map(str::trim).collect();
        match bits.as_slice() {
            [id] => out.push(ModelEntry {
                id: (*id).into(),
                label: (*id).into(),
                backend: "cloud".into(),
                description: String::new(),
            }),
            [id, label] => out.push(ModelEntry {
                id: (*id).into(),
                label: (*label).into(),
                backend: "cloud".into(),
                description: String::new(),
            }),
            [id, label, backend, ..] => out.push(ModelEntry {
                id: (*id).into(),
                label: (*label).into(),
                backend: (*backend).into(),
                description: String::new(),
            }),
            _ => {}
        }
    }
    if out.is_empty() {
        default_catalog()
    } else {
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cycles() {
        let mut r = ModelRouter::load();
        let first = r.active().id.clone();
        r.next();
        assert_ne!(r.active().id, first);
        r.prev();
        assert_eq!(r.active().id, first);
    }
}

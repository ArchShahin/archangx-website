# Seraphim Guardian: The Eternal Watch

Product family introduced on the website on 2026-11-08. This document records the brand language, the product
hierarchy, the architecture the pages describe, and the rules the pages must follow.

**Scope.** This repository is the public website only. The research codebase, the Digital Twin application, the
Codex documentation set (`Seraphim_Guardian/README.md`, `PRODUCT_VISION.md`, ... `GITHUB_GCP_DEVOPS.md`) and the
GitHub-to-GCP delivery pipeline live in the Space Data Centre repository and are maintained there.

## Brand language

| | |
|---|---|
| Family | **SERAPHIM GUARDIAN** — *The Eternal Watch* |
| Guardian Uriel | Wildfire Intelligence. Tagline: *Celestial Intelligence Protecting Life on Earth.* Line: *Intelligence that sees the first spark.* |
| Guardian Aurora | Arctic Early Warning (conceptual research module). Tagline: *The Northern Light of Eternal Vigil.* Line: *Vigilance beyond the northern horizon.* |
| Unifying statement | *From the first spark upon the Earth to the distant horizons of the Arctic sky, Seraphim Guardian envisions a future where celestial intelligence serves awareness, protection, and the preservation of life.* |

Colours (tokens in `site/assets/style.css`): deep navy and midnight blue for space (the existing `--night` band and the
Earth gradient), celestial gold `--gold`, Uriel amber `--uriel`, Aurora polar blue `--polar` and aurora green
`--aurora-green`. The symbolism is stated as a posture (a constant watch), never as a technological capability.

## Pages

| Page | File | Role |
|---|---|---|
| Seraphim Guardian | `site/guardian.html` | Landing page: identity, mission statement, two product cards, shared platform, digital twin demos, readiness, partnership |
| Guardian Uriel | `site/wildfire.html` | Wildfire intelligence product (URL kept from the former "ML Wildfire Detection" page) |
| Guardian Aurora | `site/guardian-aurora.html` | Conceptual, non-operational research module |
| Digital Twin | `site/digital-twin.html#guardian` | The two selectable demonstrations |

## Product hierarchy

```mermaid
flowchart TB
  SG[SERAPHIM GUARDIAN<br/>The Eternal Watch]
  SG --> U[Guardian Uriel<br/>Wildfire Intelligence<br/>product]
  SG --> A[Guardian Aurora<br/>Arctic Early Warning<br/>conceptual research module]
  SG --> P[Shared orbital data platform<br/>Seraphim technology stack]
  U --> UD[Uriel demo: Earth map,<br/>simulated detections]
  A --> AD[Aurora demo: Arctic view,<br/>synthetic warning lifecycle]
  P --> T[Digital Twin]
  T --> UD
  T --> AD
```

## Shared platform architecture

```mermaid
flowchart TB
  subgraph Missions["Mission environments (separated)"]
    direction LR
    UM[Guardian Uriel<br/>civilian wildfire operations<br/>fire datasets, models, agency integrations]
    AM[Guardian Aurora<br/>conceptual research environment<br/>synthetic data only]
  end
  subgraph Sep["Separated per mission"]
    direction LR
    D[Datasets and models] --- AC[Access-control policies] --- V[Validation] --- R[Security and regulatory approval]
  end
  subgraph Shared["Shared services"]
    direction LR
    ML[AI model lifecycle] --- OB[Observability and audit logging] --- IAM[Identity and access] --- SSD[Secure software delivery]
  end
  subgraph Infra["Shared infrastructure"]
    direction LR
    ING[Satellite data ingestion] --- ES[Event streaming] --- ST[Storage and metadata catalogues] --- DT[Digital twin infrastructure] --- GCP[Cloud dev and demo services]
  end
  Missions --> Sep --> Shared --> Infra
```

Rule: civilian and defence-related workloads are never mixed without explicit authorization and an approved
data-classification policy.

## Guardian Uriel processing pipeline

```mermaid
flowchart LR
  S[Satellite thermal and<br/>multispectral sensors<br/>MWIR, LWIR; optional SWIR, visible] --> C[Radiometric calibration<br/>and quality masking<br/>cloud and sensor flags]
  C --> PD[Physics-based thermal<br/>candidate detection]
  PD --> AI[Compact onboard<br/>AI verification]
  PD -. physics-only fallback .-> CS
  AI --> CS[Confidence and<br/>uncertainty scoring]
  CS --> EV[Geolocated event generation<br/>temporal correlation, FRP estimate,<br/>signed provenance]
  EV --> AL[Secure priority<br/>alert delivery]
  AL --> G[Ground dashboard<br/>and event archive]
  G --> EM[Emergency management<br/>organizations]
```

Readiness labels used on the pages: **Designed** (written down in the research), **Prototype** (running in the
digital twin on synthetic data), **Research target** (not yet built). No flight validation has taken place;
detection performance is published only with verified evidence.

## Guardian Aurora conceptual workflow

```mermaid
flowchart LR
  O[Space-based observations] --> Q[Sensor data-quality assessment]
  Q --> I[Secure event ingestion<br/>signed, integrity-checked]
  I --> B[Mission-specific<br/>analysis boundary]
  B --> H[Authorized review<br/>and validation<br/>human decision]
  H --> W[Protected early-warning<br/>information service]
```

Rules for Aurora, on every page and demonstration:
- Represented as a conceptual, non-operational research module.
- No operational target tracking, interception guidance, launch-location estimation or engagement functionality.
- No realistic trajectories, targeting solutions or interception calculations in the twin.
- Synthetic, non-sensitive demonstration data only.
- No detection-performance claims without verified evidence.

## Digital Twin integration

```mermaid
flowchart TB
  TW[Seraphim Digital Twin<br/>orbit, power, thermal, compute, network] --> SEL{Selectable demonstration}
  SEL --> U[Guardian Uriel<br/>Earth map, simulated detections,<br/>thermal anomalies, confidence and severity,<br/>satellite-to-ground event flow]
  SEL --> A[Guardian Aurora<br/>Arctic-centred view, conceptual coverage,<br/>synthetic warning-event lifecycle,<br/>provenance and authorized-review status]
  U -. synthetic data .-> N[Clearly marked as synthetic]
  A -. synthetic data .-> N
```

## Website site map after this change

```mermaid
flowchart TB
  H[index.html<br/>Home] --> G[guardian.html<br/>Seraphim Guardian]
  G --> W[wildfire.html<br/>Guardian Uriel]
  G --> AU[guardian-aurora.html<br/>Guardian Aurora]
  H --> S[technology-stack.html]
  H --> T[digital-twin.html<br/>#guardian: two demos]
  G <-->|runs on| S
  S <-->|modelled by| T
  W --> T
  AU --> T
```

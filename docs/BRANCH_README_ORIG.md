# MERIDIAN: P78 Living Ring

MERIDIAN is an experimental browser project about continuous movement between
two destructive semantic limits:

- excessive fragmentation into unrelated details;
- excessive generalization into one static conclusion.

The current working system is **P78 Living Ring**, a two-dimensional semantic
ring that receives an external phrase, analyzes its structure, visualizes the
reaction, and proposes a guarded continuation. The labels 1D, 1.5D, 2D, 2.5D,
and 3D are model regimes and interface metaphors, not claims about physical
dimensions.

## Repository map

- `prototype/p78-living-ring-interface.html` - primary interactive interface.
- `prototype/lib/` - semantic, formula, reaction, evidence, state, and view
  modules used by P78.
- `prototype/tests/` - deterministic Node.js regression suites and browser
  checks.
- `prototype/p1-*.html` through `prototype/p77-*.html` - earlier experiments,
  drafts, visual references, and reusable ideas.
- `prototype/p79-pulse-tape-1d.html` - neighboring read-only 1D projection.
- `prototype/p80-hypercube-center-3d.html` - neighboring read-only 3D
  projection.
- `docs/` - conceptual history, audits, specifications, implementation notes,
  mathematical analogies, and evidence boundaries.
- `tools/` - small calibration and data preparation utilities.
- `index.html` - catalog of project prototypes.

P1-P80 are intentionally retained. They document how the current design
developed and act as a parts library for future revisions; they should not all
be interpreted as finished products.

## Run locally

With XAMPP serving `C:\xampp\htdocs`, open:

```text
http://localhost/01/games/02/prototype/p78-living-ring-interface.html
```

The HTTP route is preferred over `file://` because browser workers and local
resource loading have stricter rules for filesystem pages.

## Tests

Run the complete deterministic regression set from the repository root:

```powershell
node prototype/tests/run-all.cjs
```

The browser-specific checks require a local HTTP server.

## Maturity and evidence

The interface, animation, state transitions, formula registry, regression
tests, and several semantic diagnostics are implemented. Natural-language
continuation remains experimental and heuristic. A numerical score or visual
regime is not by itself proof of factual truth, linguistic correctness, or a
scientific law. Documents under `docs/` distinguish implemented mechanisms
from proposals and analogies where possible.

## License

This project is distributed under the GNU Affero General Public License
version 3. See [`LICENSE`](LICENSE) for the complete terms.

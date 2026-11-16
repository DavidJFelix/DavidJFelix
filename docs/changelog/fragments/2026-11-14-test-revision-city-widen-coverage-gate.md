### test(revision.city): hold the fully covered viewer and Symbols modules to the coverage gate

The coverage gate now names the 32 modules in `src/diffs/lib` and `src/symbols/lib` that have full
line, statement and function coverage. Before, the gate held only the shared helpers, the client
config and the review engine, so coverage in the viewer and Symbols logic could fall with no signal.
The thresholds do not change.

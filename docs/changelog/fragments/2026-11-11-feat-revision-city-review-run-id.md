### feat(revision.city): give review telemetry a run id and the step attempt

Each `review run` and `model call` event now has `runId`, the Workflow instance id, so the events of
one run share one value. The run events after the start also have the check run id. Each model call
event has the review step, the step attempt (counted from 1) and the chunk number. Thus the cost of
a run with retried steps is the sum of its model calls. The three warnings in the run also have the
run fields.

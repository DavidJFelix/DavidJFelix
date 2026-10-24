### test(revision.city): read the markdown heading tests through the size check

The size check from #823 made `extractEntities` return a result that has a case for a source that is
too large. The new markdown tests from #824 read that result as a list of entities. Each pull
request passed CI alone, but together they failed the typecheck and 6 tests on main. The 3 tests now
read the entities through `extractWithinLimits`, as the other tests in the file do.

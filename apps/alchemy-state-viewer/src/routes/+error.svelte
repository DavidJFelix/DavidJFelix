<script lang="ts">
import {page} from '$app/state'
</script>

<section>
  <h1>{page.status}</h1>
  <p>{page.error?.message ?? 'Something went wrong.'}</p>
  <p><a href="/">Back to stacks</a></p>
</section>

<style>
  section {
    padding: 3rem 0;
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    margin: 0 0 0.5rem;
  }

  p {
    color: var(--muted);
  }
</style>

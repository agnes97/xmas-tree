<script lang="ts">
  import { mountGlassFir } from '../tree/glassFir';
</script>

<section class="fir">
  <div class="bar">
    <p>
      Eleven painted glass baubles hang on the fir. Sweep across the branches to set them
      turning, or grab one and spin it.
    </p>
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    {@attach mountGlassFir}
    class="stage"
    role="img"
    tabindex="0"
    aria-label="Illustrated Christmas tree with eleven glass baubles. Left and right arrow keys spin them, up and down swing them."
  ></div>
</section>

<style>
  .fir {
    --snow: #e8efe9;

    flex: 1;
    display: flex;
    flex-direction: column;
    font-family: var(--body);
  }

  @media (prefers-color-scheme: dark) {
    .fir {
      --snow: #16282b;
    }
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px 40px;
    padding: 22px max(24px, env(safe-area-inset-right, 0px)) 4px
      max(24px, env(safe-area-inset-left, 0px));
  }

  .bar p {
    margin: 0;
    max-width: 46ch;
    font-size: 15px;
  }

  .stage {
    position: relative;
    flex: 1;
    min-height: 420px;
    touch-action: none;
    outline: none;
    cursor: default;
  }

  .stage:focus-visible {
    box-shadow: inset 0 0 0 3px var(--title);
  }

  .stage :global(canvas) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  @media (max-width: 560px) {
    .bar {
      padding: 16px max(16px, env(safe-area-inset-right, 0px)) 0
        max(16px, env(safe-area-inset-left, 0px));
    }

    .bar p {
      font-size: 14px;
    }
  }
</style>

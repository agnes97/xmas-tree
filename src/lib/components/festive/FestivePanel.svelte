<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ClassValue, HTMLAttributes } from 'svelte/elements';
  import Garland from './Garland.svelte';
  import Holly from './Holly.svelte';
  import Snowfall from './Snowfall.svelte';

  type Props = HTMLAttributes<HTMLElement> & {
    /** The element the panel renders as. */
    as?: 'div' | 'header' | 'section';
    class?: ClassValue;
    /** Hang a garland across the top. */
    garland?: boolean;
    /** Tuck holly into the bottom corners. */
    holly?: boolean;
    /** How many snowflakes fall; 0 for none. */
    snow?: number;
    children: Snippet;
  };

  let {
    as = 'div',
    class: className,
    garland = false,
    holly = false,
    snow = 24,
    children,
    ...rest
  }: Props = $props();
</script>

<svelte:element this={as} class={['panel', className]} {...rest}>
  {#if snow > 0}
    <Snowfall count={snow} />
  {/if}
  {#if garland}
    <Garland />
  {/if}
  {#if holly}
    <Holly class="corner left" />
    <Holly class="corner right" />
  {/if}
  {@render children()}
</svelte:element>

<style>
  .panel {
    position: relative;
    border-radius: 22px;
    background: radial-gradient(
      120% 90% at 30% 20%,
      var(--pine-light),
      var(--pine) 55%,
      var(--pine-deep)
    );
    color: var(--cream);
    font-family: var(--body);
    box-shadow:
      inset 0 0 0 2px var(--pine-deep),
      inset 0 0 0 4px var(--gold);
  }

  .panel :global(.corner) {
    position: absolute;
    bottom: 6px;
    width: 90px;
    pointer-events: none;
  }

  .panel :global(.corner.left) {
    left: 6px;
  }

  .panel :global(.corner.right) {
    right: 6px;
    transform: scaleX(-1);
  }

  @media (max-width: 640px) {
    .panel :global(.corner) {
      width: 64px;
    }
  }
</style>

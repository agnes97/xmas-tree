<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { ClassValue, HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & {
    /** A gold circle for a single symbol (×, ‹, ›), or a pill for words. */
    shape?: 'round' | 'pill';
    /** Filled gold, for the main action. */
    primary?: boolean;
    class?: ClassValue;
    children: Snippet;
  };

  let {
    shape = 'pill',
    primary = false,
    type = 'button',
    class: className,
    children,
    ...rest
  }: Props = $props();
</script>

<button {type} class={['gold', shape, primary && 'primary', className]} {...rest}>
  {@render children()}
</button>

<style>
  .gold {
    border: 1.5px solid var(--gold);
    background: transparent;
    color: var(--gold);
    font: inherit;
    line-height: 1;
    cursor: pointer;
    transition:
      background-color 0.2s,
      color 0.2s;
  }

  .round {
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    padding: 0 0 3px;
    border-radius: 50%;
    font-size: 26px;
  }

  .pill {
    padding: 0.55rem 1.1rem;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  .gold:hover:not(:disabled),
  .primary:not(:disabled) {
    background: var(--gold);
    color: var(--pine);
  }

  .primary:hover:not(:disabled) {
    background: var(--gold-bright);
  }

  .gold:focus-visible {
    outline: 3px solid var(--cream);
    outline-offset: 2px;
  }

  .gold:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>

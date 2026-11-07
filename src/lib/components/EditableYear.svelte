<script lang="ts">
  import type { Attachment } from 'svelte/attachments';
  import { MIN_YEAR } from '../ornaments';

  type Props = {
    value: number;
    /** The decoration's name, for screen readers. */
    name: string;
    /** `card` on a decoration's card, `hero` in the story popup. */
    size?: 'card' | 'hero';
    /** Absent when the year can't be changed. */
    onCommit?: (year: number) => void;
  };

  let { value, name, size = 'card', onCommit }: Props = $props();

  const max = new Date().getFullYear();
  let editing = $state(false);
  let draft = $state<number | null>(null);
  let shake = $state(false);
  // Focus goes back to the year once it is typed, rather than falling to the page.
  let refocus = false;

  const select: Attachment<HTMLInputElement> = (input) => {
    input.focus();
    input.select();
  };

  const focusBack: Attachment<HTMLButtonElement> = (button) => {
    if (refocus) button.focus();
    refocus = false;
  };

  function start(event: MouseEvent) {
    event.stopPropagation();
    draft = value;
    editing = true;
  }

  function finish(save: boolean, keepFocus: boolean) {
    if (!editing) return;
    editing = false;
    refocus = keepFocus;
    if (!save || draft === value) return;
    if (draft === null || !Number.isInteger(draft) || draft < MIN_YEAR || draft > max) {
      shake = true;
      return;
    }
    onCommit?.(draft);
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true, true);
    } else if (event.key === 'Escape') {
      // Only stop typing; don't close a dialog around it.
      event.preventDefault();
      event.stopPropagation();
      finish(false, true);
    }
  }
</script>

{#if editing}
  <input
    {@attach select}
    class={['year', size]}
    type="number"
    inputmode="numeric"
    min={MIN_YEAR}
    {max}
    step="1"
    bind:value={draft}
    aria-label={`Year the ${name} joined the tree, ${MIN_YEAR} to ${max}`}
    {onkeydown}
    onblur={() => finish(true, false)}
    onclick={(event) => event.stopPropagation()}
  />
{:else if onCommit}
  <button
    {@attach focusBack}
    type="button"
    class={['year', size, shake && 'shake']}
    title="Change the year"
    aria-label={`${value}, the year the ${name} joined the tree. Change it`}
    onclick={start}
    onanimationend={() => (shake = false)}
  >
    {value}
  </button>
{:else}
  <span class={['year', size]}>{value}</span>
{/if}

<style>
  .year {
    display: inline-block;
    margin: 0;
    padding: 0.05em 0.42em 0.12em;
    border: 1.5px solid transparent;
    border-radius: 999px;
    font-family: var(--display);
    font-weight: 400;
    line-height: 1.1;
    font-variant-numeric: tabular-nums;
    text-align: center;
    color: inherit;
    background: transparent;
  }

  .card {
    width: 3.3em;
    font-size: var(--year-size, 15px);
  }

  .hero {
    width: 3.2em;
    font-size: 48px;
    color: var(--gold-bright);
  }

  button.year {
    cursor: pointer;
    transition:
      border-color 0.2s,
      background-color 0.2s;
  }

  button.year:hover,
  button.year:focus-visible {
    border-color: currentColor;
    border-style: dashed;
    outline: none;
  }

  input.year {
    border-color: currentColor;
    outline: none;
    appearance: textfield;
    -moz-appearance: textfield;
  }

  input.card,
  input.hero {
    background: rgb(0 0 0 / 0.25);
  }

  input.year::-webkit-inner-spin-button,
  input.year::-webkit-outer-spin-button {
    appearance: none;
    margin: 0;
  }

  .shake {
    animation: shake 0.4s;
  }

  @keyframes shake {
    20%,
    60% {
      transform: translateX(-4px);
    }
    40%,
    80% {
      transform: translateX(4px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .shake {
      animation-duration: 0.01s;
    }
  }
</style>

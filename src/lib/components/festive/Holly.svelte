<script lang="ts">
  import type { ClassValue } from 'svelte/elements';

  type Props = {
    class?: ClassValue;
    /** Gives the sprig a name for screen readers; without one it is decoration. */
    label?: string;
  };

  let { class: className, label }: Props = $props();

  // One holly leaf pointing right from its stem; each sprig turns it to fit.
  const LEAF =
    'M0 0 L7 -6 L13 -5 L17 -11 L23 -8 L29 -13 L35 -9 L41 -13 L46 -8 L53 -9 L64 0 L53 9 L46 8 L41 13 L35 9 L29 13 L23 8 L17 11 L13 5 L7 6Z';

  // An L around the bottom-left corner: one leaf up the side, one along the bottom.
  const leaves = [
    { at: 'translate(13 71) rotate(-84)', fill: '#1f6b45' },
    { at: 'translate(19 77) rotate(-6)', fill: '#2c7d51' },
  ];
</script>

<svg
  class={['holly', className]}
  viewBox="0 0 90 90"
  role={label ? 'img' : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : 'true'}
>
  {#each leaves as leaf (leaf.at)}
    <g transform={leaf.at}>
      <path d={LEAF} fill={leaf.fill} />
      <path d="M2 0 L58 0" stroke="#145236" stroke-width="1.2" stroke-linecap="round" />
    </g>
  {/each}
  <circle cx="16" cy="74" r="5.5" fill="#d0243a" />
  <circle cx="24" cy="70" r="4.5" fill="#b81c31" />
  <circle cx="12" cy="66" r="4" fill="#e03246" />
  <circle cx="14.5" cy="72" r="1.6" fill="white" opacity="0.5" />
</svg>

<style>
  .holly {
    display: block;
    flex: none;
  }
</style>

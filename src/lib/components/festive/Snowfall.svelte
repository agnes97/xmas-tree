<script lang="ts">
  type Props = {
    /** How many flakes fall at once. */
    count?: number;
  };

  let { count = 24 }: Props = $props();

  // Snowflakes with fixed, varied paths, so they don't all fall in step.
  const flakes = $derived(
    Array.from({ length: count }, (_, i) => {
      const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
      return {
        left: `${(r(1) * 100).toFixed(1)}%`,
        size: `${(3 + r(2) * 5).toFixed(1)}px`,
        duration: `${(7 + r(3) * 8).toFixed(1)}s`,
        delay: `${(-r(4) * 15).toFixed(1)}s`,
        drift: `${((r(5) - 0.5) * 60).toFixed(0)}px`,
        opacity: (0.45 + r(6) * 0.5).toFixed(2),
      };
    })
  );
</script>

<div class="snow" aria-hidden="true">
  {#each flakes as flake, i (i)}
    <span
      style:left={flake.left}
      style:width={flake.size}
      style:height={flake.size}
      style:opacity={flake.opacity}
      style:animation-duration={flake.duration}
      style:animation-delay={flake.delay}
      style:--drift={flake.drift}
    ></span>
  {/each}
</div>

<style>
  /* Fills the nearest positioned parent; set --fall to how far the flakes drop. */
  .snow {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
  }

  span {
    position: absolute;
    top: -10px;
    border-radius: 50%;
    background: white;
    filter: blur(0.6px);
    animation: fall linear infinite;
  }

  @keyframes fall {
    to {
      transform: translate(var(--drift), var(--fall, 640px));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .snow {
      display: none;
    }
  }
</style>

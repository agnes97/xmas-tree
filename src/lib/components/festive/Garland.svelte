<script lang="ts">
  type Props = {
    /** Tie a bow where neighbouring swags meet. */
    bows?: boolean;
  };

  let { bows = true }: Props = $props();

  const HEIGHT = 84;
  const EDGE = 6; // the rope's height at the panel's sides
  const PEAK = 16; // ...where two swags meet
  const DIP = 66; // the control point that pulls each swag down

  let width = $state(0);

  // About one swag per 360px, never fewer than two, so a bow always sits in the middle.
  const count = $derived(Math.max(2, Math.round(width / 360)));
  const span = $derived(width / count);

  const rope = $derived.by(() => {
    let d = `M-10 ${EDGE}`;
    for (let k = 0; k < count; k++) {
      const end = k === count - 1 ? `${width + 10} ${EDGE}` : `${(k + 1) * span} ${PEAK}`;
      d += ` Q${k * span + span / 2} ${DIP} ${end}`;
    }
    return d;
  });

  // Height of the rope a fraction t along swag k.
  function ropeY(k: number, t: number) {
    const from = k === 0 ? EDGE : PEAK;
    const to = k === count - 1 ? EDGE : PEAK;
    return (1 - t) ** 2 * from + 2 * t * (1 - t) * DIP + t ** 2 * to;
  }

  // Two baubles per swag, mirrored about the middle: short red ones towards the sides,
  // longer gold ones towards the centre.
  const dangles = $derived(
    Array.from({ length: count }, (_, k) => {
      const mid = (count - 1) / 2;
      const ts = k < mid ? [0.3, 0.6] : k > mid ? [0.4, 0.7] : [0.3, 0.7];
      return ts.map((t, j) => {
        const outer = k < mid ? j === 0 : k > mid ? j === 1 : true;
        return {
          x: k * span + t * span,
          y: ropeY(k, t) - 2,
          c: outer ? '#c0283c' : '#e2b33e',
          len: outer ? 14 : 20,
        };
      });
    }).flat()
  );

  const knots = $derived(bows ? Array.from({ length: count - 1 }, (_, k) => (k + 1) * span) : []);
</script>

<div class="garland" bind:clientWidth={width} aria-hidden="true">
  {#if width > 0}
    <svg viewBox="0 0 {width} {HEIGHT}" width={width} height={HEIGHT}>
      <g fill="none" stroke-linecap="round">
        <path d={rope} stroke="#0b3322" stroke-width="24" />
        <path d={rope} stroke="#1b5e3d" stroke-width="20" stroke-dasharray="2 3" />
        <path d={rope} stroke="#2c7d51" stroke-width="13" stroke-dasharray="1.5 4.5" />
        <path d={rope} stroke="#5ba377" stroke-width="7" stroke-dasharray="1 7" />
      </g>
      {#each dangles as d (d.x)}
        <line x1={d.x} y1={d.y} x2={d.x} y2={d.y + d.len} stroke="#e8c76a" stroke-width="1" />
        <rect x={d.x - 3} y={d.y + d.len - 2} width="6" height="4" rx="1" fill="#d8d0b8" />
        <circle cx={d.x} cy={d.y + d.len + 9} r="9" fill={d.c} />
        <circle cx={d.x - 3} cy={d.y + d.len + 6} r="2.6" fill="white" opacity="0.55" />
      {/each}
      {#each knots as x (x)}
        <g transform="translate({x - 360} 0)">
          <path d="M360 18 C340 -2 316 4 322 20 C328 34 348 26 360 18Z" fill="#c8202f" />
          <path d="M360 18 C380 -2 404 4 398 20 C392 34 372 26 360 18Z" fill="#c8202f" />
          <path d="M356 20 L340 52 L348 50 L352 58 L360 24Z" fill="#a51826" />
          <path d="M364 20 L380 52 L372 50 L368 58 L360 24Z" fill="#a51826" />
          <circle cx="360" cy="19" r="6.5" fill="#e0303f" />
        </g>
      {/each}
    </svg>
  {/if}
</div>

<style>
  .garland {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 84px;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
    transform-origin: 50% 0;
    animation: swag 1.6s ease-out;
  }

  svg {
    display: block;
  }

  @keyframes swag {
    30% {
      transform: rotate(0.8deg);
    }
    60% {
      transform: rotate(-0.5deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .garland {
      animation: none;
    }
  }
</style>

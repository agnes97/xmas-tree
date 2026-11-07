<script lang="ts">
  import { clock } from '../christmas.svelte';

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();

  const countdown = $derived(clock.countdown);
  const pad = (n: number) => String(n).padStart(2, '0');
</script>

<section class="countdown" aria-label="Countdown to Christmas Eve">
  {#if countdown.merry}
    <div class="ornament" aria-hidden="true">
      <div class="string"></div>
      <div class="cap"></div>
      <div class="sphere"><span class="big">24</span><span class="unit">December</span></div>
    </div>
    <h2>Merry Christmas</h2>
    <p class="quiet">
      The tree is up. <button type="button" class="linkish" onclick={onLoginClick}>Log in</button> to see it.
    </p>
  {:else}
    {@const { days, hours, minutes, seconds } = countdown}
    <div class="ornament" aria-hidden="true">
      <div class="string"></div>
      <div class="cap"></div>
      <div class="sphere">
        <span class="big">{days}</span><span class="unit">{days === 1 ? 'day' : 'days'}</span>
      </div>
    </div>
    <h2>until Christmas Eve</h2>
    <div
      class="clock"
      role="timer"
      aria-label={`${days} days, ${hours} hours and ${minutes} minutes until Christmas Eve`}
    >
      <div><b>{pad(hours)}</b><span>hours</span></div>
      <div><b>{pad(minutes)}</b><span>minutes</span></div>
      <div><b>{pad(seconds)}</b><span>seconds</span></div>
    </div>
    <p class="quiet">
      <button type="button" class="linkish" onclick={onLoginClick}>Log in</button> to see your tree.
    </p>
  {/if}
</section>

<style>
  .countdown {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 0;
    padding: 0 16px 48px;
    text-align: center;
  }

  .ornament {
    display: flex;
    flex-direction: column;
    align-items: center;
    transform-origin: 50% 0;
    animation: sway 7s ease-in-out infinite;
  }

  @keyframes sway {
    0%,
    100% {
      rotate: -1.6deg;
    }
    50% {
      rotate: 1.6deg;
    }
  }

  .string {
    width: 1.5px;
    height: clamp(16px, 7vh, 64px);
    background: var(--gold);
  }

  .cap {
    position: relative;
    z-index: 1;
    width: 34px;
    height: 16px;
    margin-bottom: -3px;
    border-radius: 4px 4px 2px 2px;
    background: repeating-linear-gradient(90deg, #b8892a 0 3px, #f0c75e 3px 6px);
  }

  .cap::before {
    content: '';
    position: absolute;
    left: 50%;
    top: -9px;
    width: 12px;
    height: 12px;
    translate: -50% 0;
    border: 1.5px solid var(--gold);
    border-radius: 50%;
  }

  .sphere {
    --size: clamp(150px, min(30vh, 36vw), 280px);

    position: relative;
    display: grid;
    place-content: center;
    gap: 2px;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: radial-gradient(circle at 34% 28%, #ff8d93 0, #d8283c 30%, #a31a2e 62%, #5b0c19 100%);
    box-shadow: 0 30px 50px -28px rgb(80 10 20 / 0.7);
    color: var(--cream);
  }

  .sphere::after {
    content: '';
    position: absolute;
    left: 20%;
    top: 12%;
    width: 26%;
    height: 15%;
    border-radius: 50%;
    background: rgb(255 255 255 / 0.32);
    rotate: -28deg;
    filter: blur(2px);
  }

  .big {
    font: 400 calc(var(--size) * 0.36) / 0.9 var(--display);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 0 rgb(0 0 0 / 0.22);
  }

  .unit {
    font-size: calc(var(--size) * 0.075);
    font-weight: 500;
    letter-spacing: 0.02em;
  }

  h2 {
    margin: 22px 0 0;
    font: 400 clamp(26px, 3.4vw, 40px) / 1.1 var(--display);
    color: var(--text);
    text-wrap: balance;
  }

  .clock {
    display: flex;
    gap: 22px;
    margin: 14px 0 0;
    font-variant-numeric: tabular-nums;
    color: var(--text);
  }

  .clock div {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.2ch;
  }

  .clock b {
    font: 400 28px/1 var(--display);
  }

  .clock span {
    margin-top: 4px;
    font-size: 13px;
    color: var(--text-muted);
  }

  .quiet {
    margin: 22px 0 0;
    font-size: 15px;
    color: var(--text-muted);
  }

  .linkish {
    padding: 0;
    border: 0;
    background: none;
    color: var(--text);
    font: inherit;
    font-weight: 500;
    text-decoration: underline;
    text-decoration-color: var(--gold);
    text-decoration-thickness: 2px;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .linkish:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 3px;
    border-radius: 2px;
  }

  @container app (max-width: 760px) {
    .clock {
      gap: 16px;
    }

    .clock b {
      font-size: 24px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ornament {
      animation: none;
    }
  }
</style>

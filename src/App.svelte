<script lang="ts">
  import { untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import Bookmarks from './lib/components/Bookmarks.svelte';
  import Countdown from './lib/components/Countdown.svelte';
  import GlassFir from './lib/components/GlassFir.svelte';
  import Header from './lib/components/Header.svelte';
  import LoginForm from './lib/components/LoginForm.svelte';
  import Modal from './lib/components/Modal.svelte';
  import Holly from './lib/components/festive/Holly.svelte';
  import { auth } from './lib/auth.svelte';
  import { clock } from './lib/christmas.svelte';
  import { tree } from './lib/tree.svelte';

  let isLoginOpen = $state(false);
  let isDrawerOpen = $state(false);
  let drawerToggle = $state<HTMLButtonElement>();

  const year = new Date().getFullYear();

  /** Logged out, the page counts down to Christmas Eve instead of showing a bare tree. */
  const isLoggedOut = $derived(auth.status === 'unauthenticated');

  // The baubles belong to the account: load them on login, take them down on logout.
  $effect(() => {
    const isAuthenticated = auth.isAuthenticated;
    untrack(() => (isAuthenticated ? tree.load() : tree.reset()));
  });

  $effect(() => {
    if (isLoggedOut) isDrawerOpen = false;
  });

  /** How far down the header the garland's bulbs hang; the tree's tip stays below them. */
  const GARLAND = 92;
  /** Half the width kept clear around the tree's tip, so it never runs into the title or buttons. */
  const TIP = 60;

  /**
   * Measures the header for the layout: the decorations line up under the title, and the
   * tree grows up behind the header as far as the garland, the title and the buttons allow.
   */
  const measure: Attachment<HTMLElement> = (main) => {
    const app = main.parentElement!;
    const header = main.previousElementSibling as HTMLElement;
    const footer = main.nextElementSibling as HTMLElement;
    const title = header.querySelector('h1')!;
    const blockers = [...header.querySelectorAll<HTMLElement>('.brand, .actions')];
    const set = (name: string, px: number) => app.style.setProperty(name, `${Math.round(px)}px`);

    function update() {
      const box = app.getBoundingClientRect();
      const head = header.getBoundingClientRect();
      const name = title.getBoundingClientRect();
      set('--header-h', head.height);
      set('--footer-h', footer.offsetHeight);
      set('--title-left', name.left - box.left);
      set('--title-width', name.width);

      const fir = main.querySelector('.fir');
      let lift = 0;
      if (fir) {
        const stage = fir.getBoundingClientRect();
        const middle = stage.left + stage.width / 2;
        let top = head.top + GARLAND;
        for (const blocker of blockers) {
          const r = blocker.getBoundingClientRect();
          if (r.width && r.left < middle + TIP && r.right > middle - TIP) top = Math.max(top, r.bottom + 12);
        }
        lift = Math.max(0, head.bottom - top);
      }
      set('--lift', lift);
    }

    const resizes = new ResizeObserver(update);
    for (const el of [app, header, footer, title, main, ...blockers]) resizes.observe(el);
    // The tree comes and goes with the login.
    const mutations = new MutationObserver(() => {
      const fir = main.querySelector('.fir');
      if (fir) resizes.observe(fir);
      update();
    });
    mutations.observe(main, { childList: true });
    update();

    return () => {
      resizes.disconnect();
      mutations.disconnect();
    };
  };

  function closeDrawer() {
    isDrawerOpen = false;
    drawerToggle?.focus();
  }
</script>

<svelte:window
  onbeforeunload={(event) => {
    if (tree.isDirty) event.preventDefault();
  }}
  ononline={() => auth.recheck()}
/>

<svelte:document
  onvisibilitychange={() => {
    if (document.visibilityState === 'visible') auth.recheck();
  }}
/>

<Header onLoginClick={() => (isLoginOpen = true)} />

<main {@attach measure} class={[isLoggedOut && 'solo']}>
  {#if isLoggedOut}
    <Countdown onLoginClick={() => (isLoginOpen = true)} />
  {:else}
    <Bookmarks open={isDrawerOpen} onClose={closeDrawer} />
    <GlassFir />
    <button
      bind:this={drawerToggle}
      type="button"
      class="drawer-toggle"
      aria-expanded={isDrawerOpen}
      aria-controls="rail"
      onclick={() => (isDrawerOpen = true)}
    >
      <span class="stack" aria-hidden="true">
        {#each tree.stories.slice(0, 3) as story (story.id)}
          <i style:--c={story.color}></i>
        {/each}
      </span>
      Decorations
    </button>
  {/if}
</main>

<footer>
  <span class="sig">
    <Holly class="holly" />
    <span>&copy; {year} agnes97</span>
  </span>
  {#if auth.isAuthenticated}
    {@const countdown = clock.countdown}
    <span class="next">
      {#if countdown.merry}
        <b>Merry Christmas</b>
      {:else}
        <b>{countdown.days}</b> {countdown.days === 1 ? 'day' : 'days'} to Christmas Eve
      {/if}
    </span>
  {/if}
</footer>

<Modal bind:open={isLoginOpen} title="Login">
  <LoginForm onSuccess={() => (isLoginOpen = false)} />
</Modal>

<style>
  main {
    /* The decorations sit centred under the title, as wide as it but never narrower than
       two readable cards; the 3px leave room for a card's focus ring. */
    --list-w: max(calc(var(--title-width, 300px) + 6px), 400px);
    --list-x: calc(var(--title-left, 118px) - 3px + (var(--title-width, 300px) + 6px - var(--list-w)) / 2);
    --rail-w: calc(var(--list-x) + var(--list-w) + 21px);

    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: var(--rail-w) minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
    min-height: 0;
  }

  main.solo {
    grid-template-columns: minmax(0, 1fr);
  }

  .drawer-toggle {
    display: none;
  }

  footer {
    position: relative;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 6px 24px;
    padding-block: 12px 14px;
    padding-left: max(32px, env(safe-area-inset-left, 0px));
    padding-right: max(32px, env(safe-area-inset-right, 0px));
    color: color-mix(in srgb, var(--cream) 78%, transparent);
    font-family: var(--body);
    font-size: 14px;
  }

  .sig {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .sig :global(.holly) {
    width: 26px;
    height: 26px;
  }

  .next {
    font-variant-numeric: tabular-nums;
  }

  .next b {
    font-weight: 500;
    color: var(--gold-bright);
  }

  /* Narrow, or too short for every card: the decorations open in a drawer. */
  @container app (max-width: 760px) or (max-height: 560px) {
    main {
      grid-template-columns: minmax(0, 1fr);
    }

    .drawer-toggle {
      position: absolute;
      left: max(16px, env(safe-area-inset-left, 0px));
      bottom: 30px;
      z-index: 4;
      display: flex;
      align-items: center;
      gap: 10px;
      height: 44px;
      padding: 0 16px 0 8px;
      border: 1.5px solid var(--gold);
      border-radius: 999px;
      background: var(--pine);
      color: var(--cream);
      font: 500 15px var(--body);
      cursor: pointer;
      box-shadow: 0 10px 24px -12px rgb(0 0 0 / 0.55);
    }

    .drawer-toggle:focus-visible {
      outline: 3px solid var(--focus);
      outline-offset: 2px;
    }

    .stack {
      display: flex;
    }

    .stack i {
      width: 18px;
      height: 18px;
      margin-right: -6px;
      border-radius: 50%;
      background: radial-gradient(
        circle at 34% 30%,
        color-mix(in srgb, #fff 65%, var(--c)),
        var(--c) 55%,
        color-mix(in srgb, #000 35%, var(--c))
      );
      box-shadow: 0 0 0 2px var(--pine);
    }

    .stack i:last-child {
      margin-right: 4px;
    }
  }

  @container app (max-width: 760px) {
    footer {
      justify-content: center;
      padding-block: 10px 12px;
      font-size: 13px;
      text-align: center;
    }
  }
</style>

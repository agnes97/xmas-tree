<script lang="ts">
  import { auth } from '../auth.svelte';
  import { tree } from '../tree.svelte';
  import AccountMenu from './AccountMenu.svelte';
  import FestivePanel from './festive/FestivePanel.svelte';
  import GoldButton from './festive/GoldButton.svelte';
  import Holly from './festive/Holly.svelte';

  const SINCE = 2016;

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();

  const years = new Date().getFullYear() - SINCE;
  const isEditing = $derived(auth.isAuthenticated && tree.isEditing);
</script>

<FestivePanel as="header" class={['site-header', isEditing && 'editing']} garland snow={16}>
  <div class="brand">
    <Holly class="icon" />
    <div class="titles">
      <h1>The Ornament Pipeline</h1>
      <p>
        A Christmas tradition (one bulb per year) continuously deployed since {SINCE}.
        <span class="counter">[ {years} {years === 1 ? 'year' : 'years'} ]</span>
      </p>
    </div>
  </div>

  <div class="actions">
    {#if isEditing}
      {#if tree.error}
        <span class="error" role="alert">{tree.error}</span>
      {/if}
      <GoldButton disabled={tree.status === 'saving'} onclick={() => tree.discard()}>Discard</GoldButton>
      <GoldButton primary disabled={!tree.isDirty || tree.status === 'saving'} onclick={() => tree.save()}>
        {tree.status === 'saving' ? 'Saving…' : 'Save'}
      </GoldButton>
    {:else if auth.isAuthenticated || auth.status === 'unauthenticated'}
      <AccountMenu {onLoginClick} />
    {/if}
  </div>
</FestivePanel>

<style>
  /* Full bleed: the pine runs edge to edge and on into the field below. */
  :global(header.panel.site-header) {
    position: relative;
    z-index: 4;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 14px 32px;
    padding: 80px max(32px, env(safe-area-inset-right, 0px)) 18px max(32px, env(safe-area-inset-left, 0px));
    border-radius: 0;
    /* The page paints the pine behind it, so the tree can grow up behind the header. */
    background: none;
    box-shadow: none;
    pointer-events: none;
    --fall: 260px;
  }

  .brand,
  .actions {
    pointer-events: auto;
  }

  .brand {
    position: relative;
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 0;
  }

  .brand :global(.icon) {
    width: 68px;
    transform-origin: 20% 80%;
    transition: transform 0.4s cubic-bezier(0.2, 1.6, 0.4, 1);
  }

  .brand:hover :global(.icon) {
    transform: rotate(-8deg);
  }

  .titles {
    min-width: 0;
  }

  h1 {
    width: fit-content;
    margin: 0;
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(28px, 3.2vw, 42px);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--cream);
    text-shadow: 0 2px 0 rgb(0 0 0 / 0.25);
    text-wrap: balance;
  }

  p {
    margin: 6px 0 0;
    font-size: 15px;
    color: color-mix(in srgb, var(--cream) 80%, transparent);
    text-wrap: pretty;
  }

  .counter {
    margin-left: 4px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--gold-bright);
    white-space: nowrap;
  }

  .actions {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 10px 12px;
  }

  .error {
    font-size: 14px;
    color: var(--festive-danger);
  }

  /* A lower header on short screens leaves the tree and the decorations more room. */
  @container app (max-height: 760px) {
    :global(header.panel.site-header) {
      padding-top: 66px;
      padding-bottom: 14px;
    }

    h1 {
      font-size: clamp(26px, 2.6vw, 34px);
    }

    .brand :global(.icon) {
      width: 56px;
    }
  }

  @container app (max-width: 760px) {
    :global(header.panel.site-header) {
      flex-wrap: nowrap;
      align-items: flex-start;
      gap: 12px;
      padding: 64px 16px 14px;
    }

    :global(header.panel.site-header.editing) {
      flex-wrap: wrap;
    }

    .brand {
      flex: 1;
      gap: 12px;
    }

    .brand :global(.icon) {
      width: 44px;
    }

    h1 {
      font-size: 25px;
    }

    p {
      font-size: 13.5px;
      line-height: 1.4;
    }

    :global(.site-header.editing) .actions {
      width: 100%;
      justify-content: flex-start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .brand :global(.icon) {
      transition: none;
    }
  }
</style>

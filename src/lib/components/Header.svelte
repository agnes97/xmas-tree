<script lang="ts">
  import { auth } from '../auth.svelte';
  import { tree } from '../tree.svelte';
  import FestivePanel from './festive/FestivePanel.svelte';
  import GoldButton from './festive/GoldButton.svelte';
  import Holly from './festive/Holly.svelte';

  const SINCE = 2016;

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();

  const years = new Date().getFullYear() - SINCE;
</script>

<FestivePanel as="header" class="site-header" garland snow={14}>
  <div class="brand">
    <Holly class="icon" />
    <div class="titles">
      <h1>The Ornament Pipeline</h1>
      <p>
        A Christmas tradition (one bulb per year) continuously deployed since {SINCE}.
        <span class="counter">[ {years}
          {years === 1 ? 'year' : 'years'} ]</span>
      </p>
    </div>
  </div>

  {#if auth.isAuthenticated && auth.user}
    <div class="user">
      {#if tree.isEditing}
        {#if tree.error}
          <span class="error" role="alert">{tree.error}</span>
        {/if}
        <GoldButton primary disabled={!tree.isDirty || tree.status === 'saving'} onclick={() => tree.save()}>
          {tree.status === 'saving' ? 'Saving…' : 'Save'}
        </GoldButton>
        <GoldButton disabled={tree.status === 'saving'} onclick={() => tree.discard()}>Discard</GoldButton>
      {:else}
        <span>Logged in as <strong>{auth.user.name}</strong></span>
        <GoldButton disabled={tree.status !== 'ready'} onclick={() => tree.edit()}>Edit</GoldButton>
        <GoldButton onclick={() => auth.logout()}>Logout</GoldButton>
      {/if}
    </div>
  {:else if auth.status === 'unauthenticated'}
    <GoldButton class="login" onclick={onLoginClick}>Login</GoldButton>
  {/if}
</FestivePanel>

<style>
  :global(header.panel.site-header) {
    position: relative;
    z-index: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem 2rem;
    margin: 12px 12px 0;
    padding: 84px 32px 28px;
    box-shadow:
      inset 0 0 0 2px var(--pine-deep),
      inset 0 0 0 4px var(--gold),
      0 18px 40px -24px rgb(0 0 0 / 0.6);
    --fall: 220px;
  }

  .brand {
    position: relative;
    display: flex;
    align-items: center;
    gap: 18px;
    min-width: 0;
  }

  .brand :global(.icon) {
    width: 76px;
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
    margin: 0;
    font-family: var(--display);
    font-weight: 400;
    font-size: clamp(28px, 3.4vw, 44px);
    line-height: 1.05;
    letter-spacing: -0.01em;
    color: var(--cream);
    text-shadow: 0 2px 0 rgb(0 0 0 / 0.25);
  }

  p {
    margin: 8px 0 0;
    font-size: 15px;
    line-height: 1.5;
    color: color-mix(in srgb, var(--cream) 80%, transparent);
  }

  .counter {
    margin-left: 4px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--gold-bright);
    white-space: nowrap;
  }

  .star {
    font-size: 0.85em;
    color: var(--gold);
  }

  .user {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem 1rem;
  }

  .error {
    color: var(--festive-danger);
    font-size: 0.875rem;
  }

  strong {
    font-weight: 600;
    color: var(--gold-bright);
  }

  :global(.site-header > .login) {
    position: relative;
  }

  @media (max-width: 640px) {
    :global(header.panel.site-header) {
      padding: 80px 20px 22px;
    }

    .brand {
      gap: 12px;
    }

    .brand :global(.icon) {
      width: 52px;
    }

    .user {
      justify-content: flex-start;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .brand :global(.icon) {
      transition: none;
    }
  }
</style>

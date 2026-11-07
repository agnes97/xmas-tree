<script lang="ts">
  import { tick } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import { auth } from '../auth.svelte';
  import { tree } from '../tree.svelte';

  type Props = {
    onLoginClick: () => void;
  };

  let { onLoginClick }: Props = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement>();
  let menu = $state<HTMLDivElement>();

  const user = $derived(auth.isAuthenticated ? auth.user : null);
  const initials = $derived(
    (user?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('')
  );

  const items = () => [...(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])];

  async function show() {
    open = true;
    await tick();
    items()[0]?.focus();
  }

  function hide(refocus = true) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function choose(action: () => void) {
    hide(false);
    action();
  }

  // A click anywhere outside the account control closes its menu.
  const dismiss: Attachment<HTMLElement> = (account) => {
    const onpointerdown = (event: PointerEvent) => {
      if (open && !account.contains(event.target as Node)) hide(false);
    };
    document.addEventListener('pointerdown', onpointerdown);
    return () => document.removeEventListener('pointerdown', onpointerdown);
  };

  function onkeydown(event: KeyboardEvent) {
    if (!open) return;
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      hide();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (event.key === 'Tab') {
      hide(false);
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="account" {@attach dismiss} {onkeydown}>
  <button
    bind:this={trigger}
    type="button"
    class="trigger"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls="account-menu"
    onclick={() => (open ? hide(false) : show())}
  >
    <span class="tname">{user ? user.name : 'Guest'}</span>
    <span class="avatar" aria-hidden="true">
      {#if user?.avatar}
        <img src={user.avatar} alt="" />
      {:else if user}
        {initials}
      {:else}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="8" r="4.5" />
          <path d="M3.5 21.5c0-4.8 3.8-8 8.5-8s8.5 3.2 8.5 8z" />
        </svg>
      {/if}
    </span>
  </button>

  {#if open}
    <div bind:this={menu} class={['menu', !user && 'compact']} id="account-menu" role="menu" aria-label="Account">
      {#if user}
        <div class="who">
          <p class="label">Signed in as</p>
          <p class="name">{user.name}</p>
        </div>
        <button
          type="button"
          class="item"
          role="menuitem"
          disabled={tree.status !== 'ready'}
          onclick={() => choose(() => tree.edit())}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="14" r="6" />
            <path d="M12 8V3M9.5 3h5" />
            <path d="M18.5 5.5l-2 2" />
          </svg>
          Arrange baubles
        </button>
        <div class="sep" role="separator"></div>
        <button type="button" class="item" role="menuitem" onclick={() => choose(() => auth.logout())}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
            <path d="M10 8l-4 4 4 4" />
            <path d="M6 12h10" />
          </svg>
          Logout
        </button>
      {:else}
        <button type="button" class="item" role="menuitem" onclick={() => choose(onLoginClick)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
            <path d="M14 8l4 4-4 4" />
            <path d="M18 12H8" />
          </svg>
          Login
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .account {
    position: relative;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 44px;
    padding: 0 5px 0 14px;
    border: 1.5px solid color-mix(in srgb, var(--gold) 70%, transparent);
    border-radius: 999px;
    background: rgb(0 0 0 / 0.18);
    color: var(--cream);
    font: 500 15px/1 var(--body);
    cursor: pointer;
    transition:
      border-color 0.25s,
      background-color 0.25s;
  }

  .trigger:hover,
  .trigger[aria-expanded='true'] {
    border-color: var(--gold);
    background: rgb(0 0 0 / 0.3);
  }

  .trigger:focus-visible {
    outline: 3px solid var(--cream);
    outline-offset: 2px;
  }

  .avatar {
    display: grid;
    place-items: center;
    width: 32px;
    height: 32px;
    overflow: hidden;
    border-radius: 50%;
    background: var(--gold);
    color: var(--pine-deep);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }

  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .menu {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 264px;
    padding: 8px;
    border-radius: 16px;
    background: var(--pine-deep);
    color: var(--cream);
    box-shadow:
      inset 0 0 0 1px color-mix(in srgb, var(--gold) 35%, transparent),
      0 24px 48px -16px rgb(0 0 0 / 0.6);
    transform-origin: top right;
    animation: menu-in 0.22s var(--ease-out);
  }

  /* Logged out there is only Login: the menu is no wider than it needs. */
  .menu.compact {
    width: max-content;
    min-width: 100%;
  }

  @keyframes menu-in {
    from {
      opacity: 0;
      transform: translateY(-6px) scale(0.98);
    }
  }

  .who {
    margin-bottom: 4px;
    padding: 10px 12px 12px;
    border-bottom: 1px solid color-mix(in srgb, var(--gold) 22%, transparent);
  }

  .who p {
    margin: 0;
  }

  .label {
    font-size: 13px;
    color: color-mix(in srgb, var(--cream) 70%, transparent);
  }

  .name {
    font-size: 17px;
    font-weight: 500;
    color: var(--gold-bright);
  }

  .item {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 44px;
    padding: 0 12px;
    border: 0;
    border-radius: 10px;
    background: transparent;
    color: var(--cream);
    font: 500 15px var(--body);
    text-align: left;
    cursor: pointer;
  }

  .item svg {
    flex: none;
    color: var(--gold);
  }

  .item:hover:not(:disabled),
  .item:focus-visible {
    background: color-mix(in srgb, var(--gold) 14%, transparent);
    outline: none;
  }

  .item:focus-visible {
    box-shadow: inset 0 0 0 2px var(--gold);
  }

  .item:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .sep {
    height: 1px;
    margin: 4px 6px;
    background: color-mix(in srgb, var(--gold) 22%, transparent);
  }

  @container app (max-width: 760px) {
    .trigger {
      justify-content: center;
      width: 44px;
      padding: 0;
    }

    .tname {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .menu {
      animation: none;
    }
  }
</style>

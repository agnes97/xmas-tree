<script lang="ts">
  import { untrack } from 'svelte';
  import GlassFir from './lib/components/GlassFir.svelte';
  import Header from './lib/components/Header.svelte';
  import LoginForm from './lib/components/LoginForm.svelte';
  import Modal from './lib/components/Modal.svelte';
  import { auth } from './lib/auth.svelte';
  import { tree } from './lib/tree.svelte';

  let isLoginOpen = $state(false);

  const year = new Date().getFullYear();

  // The baubles belong to the account: load them on login, take them down on logout.
  $effect(() => {
    const isAuthenticated = auth.isAuthenticated;
    untrack(() => (isAuthenticated ? tree.load() : tree.reset()));
  });
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

<main>
  <GlassFir />
</main>

<footer>&copy; {year} agnes97</footer>

<Modal bind:open={isLoginOpen} title="Login">
  <LoginForm onSuccess={() => (isLoginOpen = false)} />
</Modal>

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  footer {
    padding: 1rem 1.5rem 2rem;
    font-size: 0.875rem;
    color: var(--text-muted);
    text-align: center;
  }
</style>

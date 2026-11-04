<script lang="ts">
  import GlassFir from './lib/components/GlassFir.svelte';
  import Header from './lib/components/Header.svelte';
  import LoginForm from './lib/components/LoginForm.svelte';
  import Modal from './lib/components/Modal.svelte';

  let isLoginOpen = $state(false);

  const year = new Date().getFullYear();
</script>

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

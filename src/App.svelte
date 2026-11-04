<script lang="ts">
  import Header from './lib/components/Header.svelte';
  import LoginForm from './lib/components/LoginForm.svelte';
  import Modal from './lib/components/Modal.svelte';

  let isLoginOpen = $state(false);
</script>

<Header onLoginClick={() => (isLoginOpen = true)} />

<main></main>

<Modal bind:open={isLoginOpen} title="Login">
  <LoginForm onSuccess={() => (isLoginOpen = false)} />
</Modal>

<style>
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 2rem 1.5rem;
  }
</style>

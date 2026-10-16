<script lang="ts">
  import { onDestroy } from 'svelte';
  import AnalysisPage from './pages/AnalysisPage.svelte';
  import UploadPage from './pages/UploadPage.svelte';
  import { getTranslations, resolveLocale } from './i18n';
  import { analysisPath, createRouter, type Route } from './lib/router';

  const locale = resolveLocale(import.meta.env.VITE_LOCALE);
  const t = getTranslations(locale);
  document.documentElement.lang = locale;

  const router = createRouter();
  let route = $state<Route>(router.current());
  const unsubscribe = router.subscribe((nextRoute) => {
    route = nextRoute;
  });

  onDestroy(unsubscribe);
</script>

<svelte:head>
  <title>{t.app.heroTitle}</title>
</svelte:head>

{#if route.name === 'analysis'}
  {#key route.id}
    <AnalysisPage id={route.id} {t} onNewAnalysis={() => router.navigate('/')} />
  {/key}
{:else}
  <UploadPage {t} onUploaded={(requestId) => router.navigate(analysisPath(requestId))} />
{/if}

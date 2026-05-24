<template>
  <div class="mx-auto max-w-7xl">
    <div class="mb-6 rounded-lg border bg-white p-5 shadow-sm">
      <h1 class="text-xl font-bold text-gray-900">{{ content.title }}</h1>
      <p class="text-sm text-gray-500">{{ content.subtitle }}</p>
    </div>

    <div class="flex flex-col gap-8 lg:flex-row lg:items-start">
      <!-- TOC Sidebar -->
      <nav class="shrink-0 rounded-lg border bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:w-52">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{{ content.toc }}</p>
        <ul class="space-y-1 text-sm">
          <li v-for="section in content.sections" :key="section.id">
            <a
              :href="`#${section.id}`"
              class="block rounded px-2 py-1 text-blue-600 hover:bg-blue-50"
              @click.prevent="scrollTo(section.id)"
            >
              {{ section.title }}
            </a>
          </li>
        </ul>
      </nav>

      <!-- Content -->
      <div class="min-w-0 flex-1 space-y-6">
        <section
          v-for="section in content.sections"
          :id="section.id"
          :key="section.id"
          class="scroll-mt-6 rounded-lg border bg-white p-6 shadow-sm"
        >
          <h2 class="mb-4 text-lg font-semibold text-gray-900">{{ section.title }}</h2>

          <div v-for="(p, i) in section.paragraphs || []" :key="'p' + i" class="mb-3 text-sm leading-relaxed text-gray-700">
            {{ p }}
          </div>

          <pre
            v-if="section.code"
            class="mb-4 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-green-400"
          >{{ section.code }}</pre>

          <ul v-if="section.list?.length" class="space-y-1.5 text-sm text-gray-700">
            <li v-for="(item, j) in section.list" :key="j" class="flex gap-2">
              <span class="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
              <span>{{ item }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getXStepAgentHelp } from '../content/xstepAgentHelp';

const { locale } = useI18n();
const content = computed(() => getXStepAgentHelp(locale.value));

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

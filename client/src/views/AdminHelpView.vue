<template>
  <div>
    <div class="sap-object-header mb-6 !rounded-t-lg">
      <h1 class="text-xl font-bold">{{ content.title }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ content.subtitle }}</p>
    </div>

    <div class="flex flex-col gap-8 lg:flex-row lg:items-start">
      <nav
        class="sap-tile shrink-0 p-4 lg:sticky lg:top-4 lg:w-52"
        aria-label="Table of contents"
      >
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sapContentLabelColor)]">
          {{ content.toc }}
        </p>
        <ul class="space-y-1 text-sm">
          <li v-for="section in content.sections" :key="section.id">
            <a
              :href="`#${section.id}`"
              class="block rounded px-2 py-1 text-[var(--sapBrandColor)] hover:bg-[var(--sapHighlightColor)]"
              @click.prevent="scrollTo(section.id)"
            >
              {{ section.title }}
            </a>
          </li>
        </ul>
      </nav>

      <div class="min-w-0 flex-1 space-y-6">
        <section
          v-for="section in content.sections"
          :id="section.id"
          :key="section.id"
          class="sap-tile scroll-mt-6 p-6"
        >
          <h2 class="mb-4 text-lg font-semibold">{{ section.title }}</h2>

          <p
            v-for="(p, i) in section.paragraphs"
            :key="`p-${i}`"
            class="mb-3 text-sm leading-relaxed text-[var(--sapTextColor)]"
          >
            {{ p }}
          </p>

          <pre
            v-if="section.diagram"
            class="overflow-x-auto rounded-lg border border-[var(--sapNeutralBorderColor)] bg-slate-50 p-4 font-mono text-xs leading-snug text-slate-800"
          >{{ section.diagram }}</pre>

          <ol v-if="section.steps" class="list-decimal space-y-2 pl-5 text-sm">
            <li v-for="(step, i) in section.steps" :key="`s-${i}`">{{ step }}</li>
          </ol>

          <ul v-if="section.list" class="space-y-3 text-sm">
            <li v-for="(item, i) in section.list" :key="`l-${i}`">
              <strong class="text-[var(--sapBrandColor)]">{{ item.label }}</strong>
              <span class="text-[var(--sapTextColor)]"> — {{ item.text }}</span>
            </li>
          </ul>

          <ul v-if="section.paths" class="mt-3 space-y-1 font-mono text-xs text-slate-600">
            <li v-for="(path, i) in section.paths" :key="`path-${i}`">{{ path }}</li>
          </ul>

          <div v-if="section.table" class="mt-3 overflow-x-auto">
            <table class="min-w-full text-left text-sm">
              <thead class="sr-only">
                <tr>
                  <th scope="col">Endpoint</th>
                  <th scope="col">Description</th>
                </tr>
              </thead>
              <tbody class="divide-y">
                <tr v-for="(row, i) in section.table" :key="`t-${i}`">
                  <td class="py-2 pr-4 font-mono text-xs text-[var(--sapBrandColor)]">{{ row[0] }}</td>
                  <td class="py-2 text-[var(--sapTextColor)]">{{ row[1] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getArchitectureHelp } from '@/content/architectureHelp';

const { locale } = useI18n();

const content = computed(() => getArchitectureHelp(locale.value));

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>

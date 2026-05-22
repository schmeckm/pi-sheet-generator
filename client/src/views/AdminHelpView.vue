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

          <HelpZoomableMedia
            v-if="section.image"
            type="image"
            :src="section.image"
            :alt="sectionImageAlt(section)"
            :caption="sectionImageCaption(section)"
            :initial-scale="1.15"
          />

          <template v-if="section.bilingual">
            <div
              v-for="lang in bilingualLangs"
              :key="`${section.id}-${lang}`"
              class="mb-8 last:mb-0"
            >
              <h3
                class="mb-3 border-b border-[var(--sapNeutralBorderColor)] pb-2 text-xs font-semibold uppercase tracking-wide text-[var(--sapContentLabelColor)]"
              >
                {{ lang === 'de' ? t('help.langDe') : t('help.langEn') }}
              </h3>
              <HelpSectionBlock :block="section.locales[lang]" />
            </div>
          </template>

          <HelpSectionBlock v-else :block="section" />
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getArchitectureHelp } from '@/content/architectureHelp';
import HelpSectionBlock from '@/components/help/HelpSectionBlock.vue';
import HelpZoomableMedia from '@/components/help/HelpZoomableMedia.vue';

const { t, locale } = useI18n();

const bilingualLangs = ['de', 'en'];

const content = computed(() => getArchitectureHelp(locale.value));

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sectionImageAlt(section) {
  if (locale.value === 'en' && section.imageAltEn) return section.imageAltEn;
  return section.imageAltDe || section.imageAlt || '';
}

function sectionImageCaption(section) {
  if (locale.value === 'en' && section.imageCaptionEn) return section.imageCaptionEn;
  return section.imageCaptionDe || section.imageCaption || '';
}
</script>

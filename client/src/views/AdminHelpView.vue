<template>
  <div>
    <div class="sap-object-header mb-6 !rounded-t-lg">
      <h1 class="text-xl font-bold">{{ content.title }}</h1>
      <p class="text-sm text-[var(--sapContentLabelColor)]">{{ content.subtitle }}</p>
    </div>

    <div class="flex flex-col gap-8 lg:flex-row lg:items-start">
      <nav
        class="sap-tile shrink-0 p-4 lg:sticky lg:top-4 lg:w-52"
        :aria-label="content.toc"
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
              {{ sectionTitle(section) }}
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
          <h2 class="mb-4 text-lg font-semibold">{{ sectionTitle(section) }}</h2>

          <HelpZoomableMedia
            v-if="section.image"
            type="image"
            :src="section.image"
            :alt="sectionImageAlt(section)"
            :caption="sectionImageCaption(section)"
            :zoomable="section.imageZoomable !== false"
          />

          <HelpSectionBlock
            v-if="section.bilingual"
            :block="bilingualBlock(section)"
          />

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

const { locale } = useI18n();

const content = computed(() => getArchitectureHelp(locale.value));

const localeKey = computed(() => (locale.value === 'en' ? 'en' : 'de'));

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sectionTitle(section) {
  if (section.bilingual) {
    return localeKey.value === 'en'
      ? section.titleEn || section.title
      : section.titleDe || section.title;
  }
  return section.title;
}

function bilingualBlock(section) {
  return section.locales?.[localeKey.value] || section.locales?.de || {};
}

function sectionImageAlt(section) {
  if (localeKey.value === 'en' && section.imageAltEn) return section.imageAltEn;
  return section.imageAltDe || section.imageAlt || '';
}

function sectionImageCaption(section) {
  if (localeKey.value === 'en' && section.imageCaptionEn) return section.imageCaptionEn;
  return section.imageCaptionDe || section.imageCaption || '';
}
</script>

<template>
  <div>
    <p
      v-for="(p, i) in block.paragraphs"
      :key="`p-${i}`"
      class="mb-3 text-sm leading-relaxed text-[var(--sapTextColor)]"
    >
      {{ p }}
    </p>

    <HelpZoomableMedia
      v-if="block.diagram"
      type="diagram"
      :content="block.diagram"
      :initial-scale="1.25"
    />

    <HelpZoomableMedia
      v-if="block.image"
      type="image"
      :src="block.image"
      :alt="block.imageAlt || ''"
      :caption="block.imageCaption || ''"
      :initial-scale="1"
    />

    <ol v-if="block.steps" class="mt-3 list-decimal space-y-2 rounded-lg border border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)] p-4 pl-8 text-sm leading-relaxed">
      <li v-for="(step, i) in block.steps" :key="`s-${i}`" class="text-[var(--sapTextColor)]">
        {{ step }}
      </li>
    </ol>

    <ul v-if="block.list" class="mt-3 space-y-3 text-sm">
      <li
        v-for="(item, i) in block.list"
        :key="`l-${i}`"
        class="rounded-lg border border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)] px-3 py-2.5"
      >
        <strong class="text-[var(--sapBrandColor)]">{{ item.label }}</strong>
        <span class="text-[var(--sapTextColor)]"> — {{ item.text }}</span>
      </li>
    </ul>

    <ul v-if="block.paths" class="mt-3 space-y-1 rounded-lg border border-[var(--sapNeutralBorderColor)] bg-[var(--sapBackgroundColor)] p-3 font-mono text-xs text-[var(--sapContentLabelColor)]">
      <li v-for="(path, i) in block.paths" :key="`path-${i}`">{{ path }}</li>
    </ul>

    <p
      v-if="block.tableCaption"
      class="mb-2 mt-3 text-xs font-semibold uppercase tracking-wide text-[var(--sapContentLabelColor)]"
    >
      {{ block.tableCaption }}
    </p>

    <div v-if="block.table" class="overflow-x-auto rounded-lg border border-[var(--sapNeutralBorderColor)]">
      <table class="min-w-full text-left text-sm">
        <thead v-if="block.tableCol1" class="bg-[var(--sapBackgroundColor)] text-xs uppercase tracking-wide text-[var(--sapContentLabelColor)]">
          <tr>
            <th scope="col" class="px-3 py-2 font-semibold">{{ block.tableCol1 }}</th>
            <th scope="col" class="px-3 py-2 font-semibold">{{ block.tableCol2 }}</th>
            <th v-if="block.table?.[0]?.length > 2" scope="col" class="px-3 py-2 font-semibold">
              {{ block.tableCol3 }}
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[var(--sapNeutralBorderColor)]">
          <tr v-for="(row, i) in block.table" :key="`t-${i}`" class="bg-[var(--sapGroupContentBackground)]">
            <td
              class="px-3 py-2.5 pr-4 align-top text-[var(--sapTextColor)]"
              :class="row.length <= 2 ? 'font-mono text-xs text-[var(--sapBrandColor)]' : 'font-medium'"
            >
              {{ row[0] }}
            </td>
            <td class="px-3 py-2.5 pr-4 align-top text-[var(--sapTextColor)]">{{ row[1] }}</td>
            <td v-if="row[2]" class="px-3 py-2.5 align-top text-[var(--sapTextColor)]">{{ row[2] }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="block.notes?.length" class="mt-4 space-y-2">
      <p v-for="(note, i) in block.notes" :key="`n-${i}`" class="sap-message-strip !mb-0">
        {{ note }}
      </p>
    </div>
  </div>
</template>

<script setup>
import HelpZoomableMedia from '@/components/help/HelpZoomableMedia.vue';

defineProps({
  block: {
    type: Object,
    required: true,
  },
});
</script>

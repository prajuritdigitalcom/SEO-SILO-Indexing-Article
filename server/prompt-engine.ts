import {
  GeneratedPromptResult,
  Level2CheckboxState,
  Level2Result,
  ReferenceSnippet,
} from '../src/types.js';

export function buildReadyToPastePrompt(
  data: Level2Result,
  checkboxes: Level2CheckboxState,
  allReferenceSnippets: ReferenceSnippet[] = []
): GeneratedPromptResult {
  const sectionsToInclude = data.sections.filter(
    (sec) => checkboxes.selectedSectionIds[sec.sectionId] !== false
  );

  const recommendedUsage = data.recommendedReferenceUsage || [];
  const selectedSnippets = allReferenceSnippets.filter(
    (r) =>
      recommendedUsage.some((u) => u.snippetId === r.id) &&
      checkboxes.selectedReferenceSnippetIds?.[r.id] !== false
  );

  let selectedCount = 0;
  if (checkboxes.searchIntent) selectedCount++;
  if (checkboxes.userGoal) selectedCount++;
  if (checkboxes.primaryEntity) selectedCount++;
  if (checkboxes.supportingEntities && data.supportingEntities.length > 0) selectedCount++;
  if (checkboxes.questions && data.questions.length > 0) selectedCount++;
  if (checkboxes.conceptsToUnderstand && data.conceptsToUnderstand.length > 0) selectedCount++;
  if (checkboxes.includedScope && data.includedScope.length > 0) selectedCount++;
  if (checkboxes.excludedScope && data.excludedScope.length > 0) selectedCount++;
  if (checkboxes.evidenceRequirements && data.evidenceRequirements.length > 0) selectedCount++;
  if (checkboxes.internalLinks && data.internalLinkOpportunities.length > 0) selectedCount++;
  if (checkboxes.qualityGuidance) selectedCount++;
  if (checkboxes.searchEngineFirstWarnings && data.searchEngineFirstWarnings && data.searchEngineFirstWarnings.length > 0) selectedCount++;
  if (checkboxes.referenceMaterials && selectedSnippets.length > 0) selectedCount++;
  selectedCount += sectionsToInclude.length;

  if (selectedCount === 0) {
    throw new Error('Pilih setidaknya satu komponen penelitian untuk menghasilkan prompt.');
  }

  const lines: string[] = [];

  // Header & Role
  lines.push(`Anda adalah content strategist dan expert writer profesional yang menulis konten mendalam, obyektif, dan berfokus pada kebutuhan pembaca (People-First Content).\n`);
  lines.push(`TUJUAN KONTEN:`);
  lines.push(`Menyusun artikel/halaman komprehensif berjudul "${data.selectedPageTitle}" yang memberikan kepuasan informasi utuh tanpa bahasan berulang.\n`);

  lines.push(`TOPIK UTAMA: ${data.topic}`);
  lines.push(`HALAMAN & ROLES: ${data.selectedPageTitle} (${data.selectedPageRole})\n`);

  if (checkboxes.searchIntent) {
    lines.push(`SEARCH INTENT:`);
    lines.push(`- ${data.searchIntent}\n`);
  }

  if (checkboxes.userGoal && data.userGoal) {
    lines.push(`TUJUAN UTAMA PEMBACA (USER GOAL):`);
    lines.push(`- ${data.userGoal}\n`);
  }

  if (checkboxes.primaryEntity || (checkboxes.supportingEntities && data.supportingEntities.length > 0)) {
    lines.push(`ENTITAS & SUBJEK KUNCI:`);
    if (checkboxes.primaryEntity && data.primaryEntity) {
      lines.push(`- Entitas Utama: ${data.primaryEntity}`);
    }
    if (checkboxes.supportingEntities && data.supportingEntities.length > 0) {
      lines.push(`- Entitas Pendukung: ${data.supportingEntities.join(', ')}`);
    }
    lines.push(``);
  }

  if (checkboxes.includedScope || checkboxes.excludedScope) {
    lines.push(`BATASAN CAKUPAN HALAMAN (SCOPE BOUNDARIES):`);
    if (checkboxes.includedScope && data.includedScope.length > 0) {
      lines.push(`- Wajib Dibahas:`);
      data.includedScope.forEach((inc) => lines.push(`  * ${inc}`));
    }
    if (checkboxes.excludedScope && data.excludedScope.length > 0) {
      lines.push(`- Jangan Dibahas Berlebihan (Sudah ditangani halaman lain dalam SILO):`);
      data.excludedScope.forEach((exc) => lines.push(`  * ${exc.topic} (Ditangani oleh: ${exc.handledByPage})`));
    }
    lines.push(``);
  }

  if (checkboxes.questions && data.questions.length > 0) {
    lines.push(`PERTANYAAN PEMBACA YANG WAJIB DIJAWAB:`);
    data.questions.forEach((q, idx) => lines.push(`${idx + 1}. ${q}`));
    lines.push(``);
  }

  if (checkboxes.conceptsToUnderstand && data.conceptsToUnderstand.length > 0) {
    lines.push(`KONSEP YANG PERLU DIJELASKAN DENGAN JELAS:`);
    data.conceptsToUnderstand.forEach((c) => lines.push(`- ${c}`));
    lines.push(``);
  }

  if (sectionsToInclude.length > 0) {
    lines.push(`STRUKTUR & HIERARKI ARTIKEL YANG DIPILIH:`);
    sectionsToInclude.forEach((sec, idx) => {
      lines.push(`\n${idx + 1}. [${sec.level}] ${sec.heading}`);
      lines.push(`   • Tujuan Seksi: ${sec.purpose}`);
      if (sec.mustExplain.length > 0) {
        lines.push(`   • Poin Wajib Dijelaskan: ${sec.mustExplain.join('; ')}`);
      }
      if (sec.questions.length > 0) {
        lines.push(`   • Pertanyaan Pembaca: ${sec.questions.join('; ')}`);
      }
      if (sec.entities.length > 0) {
        lines.push(`   • Istilah/Entitas Relevan: ${sec.entities.join(', ')}`);
      }
      if (sec.evidenceRequirements.length > 0) {
        lines.push(`   • Bukti/Data yang Disarankan: ${sec.evidenceRequirements.join('; ')}`);
      }
    });
    lines.push(``);
  }

  if (checkboxes.evidenceRequirements && data.evidenceRequirements.length > 0) {
    lines.push(`BUKTI / EVIDENCE LAPANGAN YANG DISARANKAN:`);
    data.evidenceRequirements.forEach((ev) => lines.push(`- ${ev}`));
    lines.push(`(Catatan: Berikan panduan visual/data teknis ini bila berlaku, jangan mengarang fakta palsu).\n`);
  }

  if (checkboxes.referenceMaterials && selectedSnippets.length > 0) {
    lines.push(`INFORMASI REFERENSI RESMI PERUSAHAAN (FAKTA DASAR — GUNAKAN APA ADANYA):`);
    selectedSnippets.forEach((snippet) => {
      lines.push(`- [${snippet.title}]${snippet.category ? ` (${snippet.category})` : ''}: ${snippet.content}`);
    });
    lines.push(`(Catatan: Poin-poin di atas adalah data/fakta resmi yang telah diverifikasi dan relevan untuk halaman ini. Gunakan fakta dan angka ini secara akurat dalam konten tanpa mengubah nilainya atau mengarang klaim tambahan).\n`);
  }

  if (checkboxes.internalLinks && data.internalLinkOpportunities.length > 0) {
    lines.push(`REKOMENDASI TAUTAN INTERNAL (INTERNAL LINKING):`);
    data.internalLinkOpportunities.forEach((link) => {
      const href =
        data.websiteUrl && link.targetSlug
          ? `${data.websiteUrl}/${link.targetSlug}`
          : null;

      if (href) {
        lines.push(
          `- Tautkan ke "${link.targetPage}" menggunakan jangkar teks alami "${link.suggestedAnchor}" pada konteks: ${link.context}. WAJIB gunakan href persis: ${href} — jangan diubah, dipendekkan, atau diganti URL lain.`
        );
      } else {
        lines.push(
          `- Tautkan ke "${link.targetPage}" menggunakan jangkar teks alami "${link.suggestedAnchor}" pada konteks: ${link.context}.`
        );
      }
    });
    lines.push(``);
  }

  if (checkboxes.qualityGuidance) {
    lines.push(`QUALITY GUARDRAILS (GOOGLE PEOPLE-FIRST):`);
    lines.push(`1. Jangan melakukan keyword stuffing. Tulis kalimat secara alami dan mudah dibaca.`);
    lines.push(`2. Jangan mengarang pengalaman langsung, sertifikasi palsu, data uji buatan, atau klaim tanpa dasar.`);
    lines.push(`3. Fokus pada pemenuhan kebutuhan pembaca, bukan jumlah kata berbelit-belit.`);
    lines.push(`4. Sajikan struktur yang rapi, poin-poin yang mudah discan, serta penjelasan rasional.`);
    lines.push(`5. Pertimbangkan apakah halaman ini memerlukan disclosure penggunaan AI/otomasi sesuai kebijakan Google Search Central tentang transparansi konten (di luar cakupan generate ini — keputusan publikasi ada di tangan Anda).`);
    if (data.peopleFirstQualityGuidance.length > 0) {
      data.peopleFirstQualityGuidance.forEach((g) => lines.push(`- ${g}`));
    }
    lines.push(``);
  }

  // P0 (§3.1): Peringatan Spesifik Halaman Ini
  if (checkboxes.searchEngineFirstWarnings && data.searchEngineFirstWarnings && data.searchEngineFirstWarnings.length > 0) {
    lines.push(`PERINGATAN SPESIFIK HALAMAN INI (HINDARI):`);
    data.searchEngineFirstWarnings.forEach((w) => lines.push(`- ${w}`));
    lines.push(``);
  }

  // P1 (§4.7): Contoh Gaya Tulisan Asli (Writing Voice Sample)
  if (data.writingVoiceSample && data.writingVoiceSample.trim().length > 0) {
    lines.push(`CONTOH GAYA TULISAN YANG HARUS DITIRU (bukan untuk disalin isinya, hanya suara/nada/ritme kalimatnya):`);
    lines.push(`"""\n${data.writingVoiceSample.trim()}\n"""\n`);
  }

  // HUMAN-LIKE EDITORIAL WRITING BLOCK (Lengkap & Anti-AI Slop)
  lines.push(`HUMAN-LIKE EDITORIAL WRITING:`);
  lines.push(`Write for a real human reader, not for an AI detector.`);
  lines.push(`The goal is to make the article useful, specific, natural, and thoughtful.`);
  lines.push(`Do not mechanically convert the outline into repetitive prose.`);
  lines.push(`Vary sentence length and paragraph rhythm naturally.`);
  lines.push(`Do not let multiple consecutive sentences have the same shape or length.`);
  lines.push(`Do not give every paragraph the same topic-sentence → explanation → example → summary pattern.`);
  lines.push(`Avoid excessive lists of three.`);
  lines.push(`Do not overuse formal transition phrases such as "Selain itu", "Lebih lanjut", "Oleh karena itu", "Namun demikian", "Pada akhirnya", "Sebagai kesimpulan", or their English equivalents.`);
  lines.push(`Avoid generic introductions and generic conclusions.`);
  lines.push(`Use concrete details from the provided research whenever available.`);
  lines.push(`Do not invent numbers, experiences, studies, sources, specifications, or examples.`);
  lines.push(`Do not use first-person experiences unless such experiences are explicitly provided in the source material.`);
  lines.push(`When the evidence supports a clear conclusion, state the point clearly instead of hiding behind excessive hedging.`);
  lines.push(`Use natural Indonesian that could plausibly be spoken by a knowledgeable person.`);
  lines.push(`Prefer simple, precise wording over unnecessary corporate or academic vocabulary.`);
  lines.push(`Do not force synonyms merely to avoid repetition.`);
  lines.push(`Do not overuse bold, italic, rhetorical questions, analogies, or decorative phrasing.`);
  lines.push(`Avoid formulaic constructions such as:`);
  lines.push(`- "bukan hanya X, tetapi juga Y"`);
  lines.push(`- "bukan sekadar X, melainkan Y"`);
  lines.push(`- "tidak hanya X, tetapi Y"`);
  lines.push(`Use those constructions only when they are genuinely natural and useful.`);
  lines.push(`Avoid AI-associated decorative wording such as:`);
  lines.push(`- delve, tapestry, realm, landscape as metaphor, unlock, unleash, harness, ultimately, in conclusion, what nobody tells you`);
  lines.push(`Hindari juga padanan Indonesia-nya seperti: "penting untuk dicatat bahwa", "tidak dapat dipungkiri bahwa", "hal ini menunjukkan betapa pentingnya", "menjadi bukti nyata", "menegaskan pentingnya", "memainkan peran penting dalam", "tidak heran jika", "di dunia yang serba cepat ini".`);
  lines.push(`This is a small watchlist, not a rigid vocabulary ban. Context and meaning always take priority.`);
  lines.push(`Hindari penggunaan em dash (—) secara berlebihan. Gunakan koma, tanda kurung, atau kalimat terpisah sebagai gantinya.`);
  lines.push(`Gunakan sentence case untuk semua heading H2/H3 (kapital hanya di awal kalimat dan nama diri), bukan Title Case Di Setiap Kata.`);
  lines.push(`Jangan menutup setiap seksi/H2 dengan paragraf yang merangkum ulang apa yang baru saja dijelaskan pada seksi yang sama.`);
  lines.push(`Hindari konstruksi "false range" seperti "mulai dari X hingga Y" kecuali X dan Y benar-benar merepresentasikan rentang nyata dan relevan.`);
  lines.push(`Do not try to evade AI detectors.`);
  lines.push(`Do not perform synonym spinning or automated paraphrasing.`);
  lines.push(`Preserve every important fact, figure, name, specification, source-supported claim, and selected requirement from the research.`);
  lines.push(`The article should feel like a knowledgeable human thought carefully about the topic and then explained it clearly.\n`);
  lines.push(`SEBELUM MENGELUARKAN OUTPUT FINAL:`);
  lines.push(`Tulis draf secara internal terlebih dahulu. Periksa draf tersebut terhadap seluruh aturan di atas satu per satu. Revisi bagian yang masih melanggar. Hanya tampilkan versi final yang sudah direvisi — jangan tampilkan draf awal, catatan pemeriksaan, atau penjelasan proses revisi.\n`);

  // OUTPUT FORMAT BLOCK (CLEAN SEMANTIC HTML)
  lines.push(`OUTPUT FORMAT:`);
  lines.push(`Return only a clean semantic HTML article fragment suitable for direct copy-paste into Blogger or WordPress.`);
  lines.push(`Requirements:`);
  lines.push(`- Use one <h1> for the main article title.`);
  lines.push(`- Use hierarchical <h2> and <h3> headings.`);
  lines.push(`- Use <p> for normal paragraphs.`);
  lines.push(`- Use <strong> only for meaningful emphasis.`);
  lines.push(`- Use <em> or <i> only when semantically appropriate.`);
  lines.push(`- Use <ul>/<ol>/<li> only when a list genuinely improves clarity.`);
  lines.push(`- Use <table> with semantic table elements (<thead>, <tbody>, <tr>, <th>, <td>) when a table is genuinely useful.`);
  lines.push(`- Use <a href="..."> for internal links naturally embedded in paragraph text.`);
  lines.push(`- Use <figure>, <img>, and <figcaption> only when valid image URLs are supplied.`);
  lines.push(`- Never invent image URLs.`);
  lines.push(`- Do not output Markdown.`);
  lines.push(`- Do not output Markdown code fences (e.g., \`\`\`html or \`\`\`).`);
  lines.push(`- Do not output <!DOCTYPE html>.`);
  lines.push(`- Do not output <html>, <head>, or <body>.`);
  lines.push(`- Do not output <style>.`);
  lines.push(`- Do not output <script>.`);
  lines.push(`- Do not output inline CSS (e.g., style="...").`);
  lines.push(`- Do not output JavaScript.`);
  lines.push(`- Do not add commentary or explanations before or after the article.`);
  lines.push(`- Return only the finished article HTML fragment.\n`);

  // FINAL WRITING PRINCIPLE
  lines.push(`FINAL WRITING PRINCIPLE:`);
  lines.push(`Use the research architecture above as a knowledge map, not as a rigid style template.`);
  lines.push(`Write like an author who deeply understands the topic and is explaining it to a real reader.`);
  lines.push(`Prioritize concrete details over abstract claims.`);
  lines.push(`Use simple, direct language when it is the clearest option.`);
  lines.push(`Vary rhythm, sentence length, and paragraph structure naturally.`);
  lines.push(`Do not make every section feel like it was built from the same mold.`);
  lines.push(`Do not inflate the significance of the topic with empty filler.`);
  lines.push(`Do not invent experiences, data, studies, numbers, sources, or claims.`);
  lines.push(`Ensure the final output is pure, clean semantic HTML ready to publish on Blogger or WordPress.`);

  const promptText = lines.join('\n');

  let includedCount = 0;
  if (promptText.includes('SEARCH INTENT:')) includedCount++;
  if (promptText.includes('TUJUAN UTAMA PEMBACA')) includedCount++;
  if (promptText.includes('ENTITAS & SUBJEK KUNCI:')) includedCount++;
  if (promptText.includes('PERTANYAAN PEMBACA YANG WAJIB DIJAWAB:')) includedCount++;
  if (promptText.includes('KONSEP YANG PERLU DIJELASKAN')) includedCount++;
  if (promptText.includes('BATASAN CAKUPAN HALAMAN')) includedCount++;
  if (promptText.includes('STRUKTUR & HIERARKI ARTIKEL')) includedCount++;
  if (promptText.includes('BUKTI / EVIDENCE LAPANGAN')) includedCount++;
  if (promptText.includes('INFORMASI REFERENSI RESMI')) includedCount++;
  if (promptText.includes('REKOMENDASI TAUTAN INTERNAL')) includedCount++;
  if (promptText.includes('QUALITY GUARDRAILS')) includedCount++;
  if (promptText.includes('PERINGATAN SPESIFIK HALAMAN INI')) includedCount++;
  if (promptText.includes('CONTOH GAYA TULISAN YANG HARUS DITIRU')) includedCount++;
  if (promptText.includes('HUMAN-LIKE EDITORIAL WRITING:')) includedCount++;
  if (promptText.includes('OUTPUT FORMAT:')) includedCount++;

  // P0 (§3.4): Hitung missingCount dinamis untuk komponen riset yang tersedia namun dimatikan oleh user
  let missingCount = 0;
  if (!checkboxes.searchIntent) missingCount++;
  if (!checkboxes.userGoal && data.userGoal) missingCount++;
  if (!checkboxes.primaryEntity && data.primaryEntity) missingCount++;
  if (!checkboxes.supportingEntities && data.supportingEntities?.length > 0) missingCount++;
  if (!checkboxes.questions && data.questions?.length > 0) missingCount++;
  if (!checkboxes.conceptsToUnderstand && data.conceptsToUnderstand?.length > 0) missingCount++;
  if (!checkboxes.includedScope && data.includedScope?.length > 0) missingCount++;
  if (!checkboxes.excludedScope && data.excludedScope?.length > 0) missingCount++;
  if (!checkboxes.evidenceRequirements && data.evidenceRequirements?.length > 0) missingCount++;
  if (!checkboxes.internalLinks && data.internalLinkOpportunities?.length > 0) missingCount++;
  if (!checkboxes.qualityGuidance && data.peopleFirstQualityGuidance?.length > 0) missingCount++;
  if (!checkboxes.searchEngineFirstWarnings && data.searchEngineFirstWarnings?.length > 0) missingCount++;
  if (!checkboxes.referenceMaterials && (data.recommendedReferenceUsage?.length || 0) > 0) missingCount++;
  const excludedSectionsCount = data.sections.length - sectionsToInclude.length;
  missingCount += excludedSectionsCount;

  return {
    id: `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    version: 1,
    promptText,
    selectedComponentIdsCount: selectedCount,
    includedCount,
    missingCount,
    createdAt: new Date().toISOString(),
    isOutdated: false,
  };
}

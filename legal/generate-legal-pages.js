const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function normalize(text) {
  return text
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2022/g, '')
    .replace(/\r\n/g, '\n');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toJsxInline(text) {
  const src = normalize(text);
  const re =
    /(https:\/\/screenmerch\.com\/privacy-policy|https:\/\/screenmerch\.com\/terms-of-service|support@screenmerch\.com|https:\/\/screenmerch\.com)/g;
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push({ type: 'text', value: src.slice(last, m.index) });
    parts.push({ type: 'match', value: m[0] });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ type: 'text', value: src.slice(last) });
  return parts
    .map((p) => {
      if (p.type === 'text') return esc(p.value);
      if (p.value === 'https://screenmerch.com/privacy-policy') {
        return '<Link to="/privacy-policy">https://screenmerch.com/privacy-policy</Link>';
      }
      if (p.value === 'https://screenmerch.com/terms-of-service') {
        return '<Link to="/terms-of-service">https://screenmerch.com/terms-of-service</Link>';
      }
      if (p.value === 'support@screenmerch.com') {
        return '<a href="mailto:support@screenmerch.com">support@screenmerch.com</a>';
      }
      return '<a href="https://screenmerch.com" target="_blank" rel="noopener noreferrer">https://screenmerch.com</a>';
    })
    .join('');
}

function isMainHeading(line) {
  return /^\d+\.\s+\S/.test(line) && !/^\d+\.\d+/.test(line);
}

function isSubHeading(line) {
  return /^\d+\.\d+(?:\.\d+)?\s+\S/.test(line);
}

/** Section 5 / similar: lines that are list items after an intro ending with colon */
function looksLikeListItem(line, prevEndedWithColon) {
  if (!prevEndedWithColon && !/^[a-z]/.test(line) && !/^[A-Z][a-z].*;$/.test(line)) {
    // lowercase start often means continuation list in these docs
  }
  // Explicit: lines that end with ; or . and start lowercase after a "that:" intro
  return /^[a-z]/.test(line) || /;$/.test(line) || line.endsWith('; or');
}

function parseDocument(raw, { skipUntil }) {
  const lines = normalize(raw)
    .split('\n')
    .map((l) => l.trim())
    .filter((l, idx, arr) => {
      // keep structure; empty lines as separators later
      return true;
    });

  let i = 0;
  while (i < lines.length && !isMainHeading(lines[i])) i += 1;

  const preamble = [];
  // Collect non-empty preamble lines between title markers and first section if needed
  // For now we hardcode headers in the page template.

  const sections = [];
  while (i < lines.length) {
    const title = lines[i];
    i += 1;
    const blocks = [];
    let paragraphParts = [];
    let listMode = false;
    let listItems = [];
    let waitingForList = false;

    const flushParagraph = () => {
      if (paragraphParts.length) {
        blocks.push({ type: 'p', text: paragraphParts.join(' ') });
        paragraphParts = [];
      }
    };
    const flushList = () => {
      if (listItems.length) {
        blocks.push({ type: 'ul', items: listItems });
        listItems = [];
      }
      listMode = false;
    };

    while (i < lines.length && !isMainHeading(lines[i])) {
      const line = lines[i];
      i += 1;
      if (!line) {
        flushParagraph();
        flushList();
        waitingForList = false;
        continue;
      }
      if (isSubHeading(line)) {
        flushParagraph();
        flushList();
        waitingForList = false;
        blocks.push({ type: 'h3', text: line });
        continue;
      }

      // Start of a list after a sentence ending with "that:" or "including:" or "from:"
      if (/:\s*$/.test(line) && /(?:that|including|from|to the following categories of recipients|following purposes|implement|right to|following)\s*:?\s*$/i.test(line.replace(/:\s*$/, '') + ':')) {
        flushList();
        paragraphParts.push(line);
        flushParagraph();
        waitingForList = true;
        listMode = true;
        continue;
      }

      if (waitingForList || listMode) {
        // Section 5 style list items are lowercase-starting clauses
        if (looksLikeListItem(line, true) || waitingForList) {
          // strip trailing "; or" / ";" for cleaner bullets, keep content
          let item = line.replace(/;\s*or\s*$/i, '').replace(/;\s*$/, '').replace(/\.\s*$/, '');
          // If this looks like a normal paragraph (long and starts with capital after blank), stop list
          if (!waitingForList && /^[A-Z]/.test(line) && line.length > 120 && !/;$/.test(line)) {
            flushList();
            waitingForList = false;
            paragraphParts.push(line);
            continue;
          }
          listItems.push(item);
          waitingForList = true;
          listMode = true;
          // End list when item ends with period and next would be capital paragraph - handled on next lines
          if (/\.\s*$/.test(line) && !/;$/.test(line) && !/;\s*or\s*$/i.test(line)) {
            // last list item often ends with period
            flushList();
            waitingForList = false;
          }
          continue;
        }
      }

      // All-caps disclaimer / liability paragraphs stay as paragraphs
      paragraphParts.push(line);
    }
    flushParagraph();
    flushList();
    sections.push({ title, blocks });
  }

  return sections;
}

function sectionClassName(title) {
  const t = title.toLowerCase();
  if (t.includes('intellectual property') || t.includes('platform protection') || t.includes('platform circumvention')) {
    return ' critical-box';
  }
  if (t.includes('umbrella')) return ' critical-box';
  if (t.includes('sms')) return ' sms-section';
  if (t.includes('content processing') || t.includes('security')) return ' security-box';
  return '';
}

function renderBlocks(blocks, indent = '          ') {
  return blocks
    .map((b) => {
      if (b.type === 'h3') {
        return `${indent}<h3>${esc(b.title || b.text)}</h3>`;
      }
      if (b.type === 'p') {
        return `${indent}<p>${toJsxInline(b.text)}</p>`;
      }
      if (b.type === 'ul') {
        const items = b.items
          .map((item) => `${indent}  <li>${toJsxInline(item)}</li>`)
          .join('\n');
        return `${indent}<ul>\n${items}\n${indent}</ul>`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function renderPage({
  componentName,
  containerClass,
  contentClass,
  cssImport,
  logoImport,
  h1,
  subtitle,
  version,
  effectiveDate,
  lastUpdated,
  sections,
  navOther,
}) {
  const body = sections
    .map((sec) => {
      const cls = sectionClassName(sec.title);
      const open = cls
        ? `        <section className="${cls.trim()}">`
        : '        <section>';
      const heading = sec.title
        ? `\n          <h2>${esc(sec.title)}</h2>`
        : '';
      return `${open}${heading}
${renderBlocks(sec.blocks)}
        </section>`;
    })
    .join('\n\n');

  return `import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '${cssImport}';
import screenMerchLogo from '${logoImport}';

const ${componentName} = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const main = document.querySelector('.main-content-area');
    if (main) main.scrollTop = 0;
  }, [location.key, location.pathname]);

  return (
    <div className="${containerClass}">
      <div className="${contentClass}">
        <div className="logo">
          <img src={screenMerchLogo} alt="ScreenMerch Logo" className="logo-img" />
        </div>

        <header className="legal-header">
          <h1>${esc(h1)}</h1>
          ${subtitle ? `<p className="legal-subtitle">${esc(subtitle)}</p>` : ''}
          <div className="legal-meta">
            <span className="legal-version">${esc(version)}</span>
            <span className="legal-date">Effective ${esc(effectiveDate)}</span>
            <span className="legal-date">Last updated ${esc(lastUpdated)}</span>
          </div>
        </header>

${body}

        <div className="navigation-links">
          <Link to="/" className="nav-link">&larr; Back to ScreenMerch</Link> |{' '}
          ${navOther}
        </div>
      </div>
    </div>
  );
};

export default ${componentName};
`;
}

// --- Terms special-case Section 5 list (known structure) ---
function refineTermsSections(sections) {
  return sections.map((sec) => {
    if (!sec.title.startsWith('5.')) return sec;
    // Rebuild from concatenated paragraphs if list detection failed
    const allText = sec.blocks.filter((b) => b.type === 'p').map((b) => b.text).join('\n');
    const marker = 'You may not upload, offer, request, promote, or use content or conduct that:';
    const idx = allText.indexOf(marker);
    if (idx === -1) return sec;
    const before = allText.slice(0, idx + marker.length).trim();
    const afterChunk = allText.slice(idx + marker.length).trim();
    // Split on "; " that separates list items - also "or " at end
    const closing = 'ScreenMerch and its fulfillment partners';
    let listPart = afterChunk;
    let after = '';
    const cIdx = afterChunk.indexOf(closing);
    if (cIdx !== -1) {
      listPart = afterChunk.slice(0, cIdx).trim();
      after = afterChunk.slice(cIdx).trim();
    }
    const items = listPart
      .split(/;\s*(?:or\s+)?(?=[a-z])/)
      .map((s) => s.replace(/^or\s+/, '').replace(/\.\s*$/, '').trim())
      .filter(Boolean);
    const blocks = [
      { type: 'p', text: before },
      { type: 'ul', items },
    ];
    if (after) blocks.push({ type: 'p', text: after });
    // Keep any h3 blocks if present
    const h3s = sec.blocks.filter((b) => b.type === 'h3');
    return { ...sec, blocks: [...h3s, ...blocks] };
  });
}

function refinePrivacySections(sections) {
  // Fix mashed contact address in section 18
  return sections.map((sec) => {
    if (!sec.title.startsWith('18.')) return sec;
    const blocks = [];
    for (const b of sec.blocks) {
      if (b.type === 'p' && /Privacy Officer/i.test(b.text) && /1311 Park/.test(b.text)) {
        blocks.push({ type: 'p', text: 'For privacy questions, concerns, or requests, contact:' });
        blocks.push({
          type: 'p',
          text: 'ScreenMerch, Attn: Privacy Officer, 1311 Park Street, Unit #543, Alameda, California 94501',
        });
        blocks.push({ type: 'p', text: 'Email: support@screenmerch.com' });
        blocks.push({ type: 'p', text: 'Website: https://screenmerch.com' });
      } else {
        blocks.push(b);
      }
    }
    return { ...sec, blocks };
  });
}

function refineUseSections(sections) {
  // Section 3 How We Use - convert consecutive sentence lines to bullets if they look like imperative list
  return sections.map((sec) => {
    if (!/^3\./.test(sec.title) || !/How We Use/i.test(sec.title)) return sec;
    const items = sec.blocks.filter((b) => b.type === 'p').map((b) => b.text.replace(/\.\s*$/, ''));
    if (items.length < 3) return sec;
    return { ...sec, blocks: [{ type: 'ul', items }] };
  });
}

function refineDisclosureSections(sections) {
  return sections.map((sec) => {
    if (!/^5\./.test(sec.title) || !/Disclose/i.test(sec.title)) return sec;
    const paras = sec.blocks.filter((b) => b.type === 'p');
    if (!paras.length) return sec;
    const intro = paras[0].text;
    const rest = paras.slice(1);
    // First paragraph may include intro + first items mashed - try split
    const marker = 'including to the following categories of recipients:';
    if (intro.includes(marker) && rest.length) {
      const items = rest
        .slice(0, -1)
        .map((p) => p.text.replace(/\.\s*$/, ''))
        .filter(Boolean);
      const closing = rest[rest.length - 1];
      return {
        ...sec,
        blocks: [
          { type: 'p', text: intro },
          { type: 'ul', items },
          closing,
        ],
      };
    }
    // All after first are bullets if they look like category lines
    if (rest.length >= 3) {
      return {
        ...sec,
        blocks: [
          { type: 'p', text: intro },
          { type: 'ul', items: rest.slice(0, -1).map((p) => p.text.replace(/\.\s*$/, '')) },
          rest[rest.length - 1],
        ],
      };
    }
    return sec;
  });
}

// Manual high-quality render for known list sections in privacy "Information You Provide" etc.
function rebuildPrivacyFromRaw(raw) {
  const text = normalize(raw);
  const lines = text.split('\n').map((l) => l.trim());
  let i = 0;
  while (i < lines.length && !isMainHeading(lines[i])) i += 1;

  const sections = [];
  while (i < lines.length) {
    const title = lines[i++];
    const contentLines = [];
    while (i < lines.length && !isMainHeading(lines[i])) {
      contentLines.push(lines[i++]);
    }
    sections.push({ title, contentLines });
  }

  const h3Titles = new Set([
    'Information You Provide',
    'Payment Information',
    'Information Collected Automatically',
    'Information From Other Sources',
  ]);

  return sections.map((sec) => {
    const blocks = [];
    let buf = [];
    let listItems = [];
    const flushP = () => {
      if (buf.length) {
        blocks.push({ type: 'p', text: buf.join(' ') });
        buf = [];
      }
    };
    const flushL = () => {
      if (listItems.length) {
        blocks.push({ type: 'ul', items: listItems });
        listItems = [];
      }
    };

    // Special: section 2 has h3 + bullet-like sentences
    if (sec.title.startsWith('2.')) {
      for (const line of sec.contentLines) {
        if (!line) {
          flushP();
          flushL();
          continue;
        }
        if (h3Titles.has(line)) {
          flushP();
          flushL();
          blocks.push({ type: 'h3', text: line });
          continue;
        }
        // Under h3s, each non-empty line is a bullet
        const lastBlock = blocks[blocks.length - 1];
        if (lastBlock && (lastBlock.type === 'h3' || lastBlock.type === 'ul')) {
          if (lastBlock.type === 'h3') {
            listItems.push(line.replace(/\.\s*$/, ''));
          } else {
            // continue ul
            listItems.push(line.replace(/\.\s*$/, ''));
          }
          continue;
        }
        if (listItems.length) {
          listItems.push(line.replace(/\.\s*$/, ''));
          continue;
        }
        buf.push(line);
      }
      flushP();
      flushL();
      return { title: sec.title, blocks };
    }

    if (sec.title.startsWith('3.')) {
      for (const line of sec.contentLines) {
        if (!line) continue;
        listItems.push(line.replace(/\.\s*$/, ''));
      }
      flushL();
      return { title: sec.title, blocks };
    }

    if (sec.title.startsWith('5.')) {
      let sawIntro = false;
      for (const line of sec.contentLines) {
        if (!line) {
          flushP();
          continue;
        }
        if (!sawIntro) {
          buf.push(line);
          if (line.includes('categories of recipients:')) {
            flushP();
            sawIntro = true;
          }
          continue;
        }
        // last paragraph is the closing note about Printful/Stripe
        if (
          line.startsWith('Service providers may process') ||
          line.startsWith('For fulfillment') ||
          line.startsWith('Payment processing')
        ) {
          flushL();
          buf.push(line);
          continue;
        }
        listItems.push(line.replace(/\.\s*$/, ''));
      }
      flushL();
      flushP();
      return { title: sec.title, blocks };
    }

    if (sec.title.startsWith('10.')) {
      for (const line of sec.contentLines) {
        if (!line) {
          flushP();
          continue;
        }
        if (/^(Program|Expected frequency|Opt out|Help|Carrier):/i.test(line)) {
          flushP();
          listItems.push(line);
          continue;
        }
        if (listItems.length && /^(Program|Expected frequency|Opt out|Help|Carrier):/i.test(line) === false) {
          // if we were in list and hit normal para
          if (/^Opting out/.test(line)) {
            flushL();
            buf.push(line);
            continue;
          }
        }
        if (listItems.length && !/^(Program|Expected frequency|Opt out|Help|Carrier):/i.test(line)) {
          flushL();
        }
        buf.push(line);
      }
      flushL();
      flushP();
      return { title: sec.title, blocks };
    }

    if (sec.title.startsWith('11.')) {
      let first = true;
      for (const line of sec.contentLines) {
        if (!line) {
          flushP();
          continue;
        }
        if (first) {
          buf.push(line);
          flushP();
          first = false;
          continue;
        }
        listItems.push(line.replace(/\.\s*$/, ''));
      }
      flushL();
      flushP();
      return { title: sec.title, blocks };
    }

    if (sec.title.startsWith('18.')) {
      return {
        title: '',
        blocks: [
          {
            type: 'p',
            text: 'Privacy questions, concerns, or requests may be sent to support@screenmerch.com or mailed to: ScreenMerch, Attn: Privacy Officer, 1311 Park Street, Unit #543, Alameda, California 94501.',
          },
        ],
      };
    }

    // Default: subheadings + paragraphs
    for (const line of sec.contentLines) {
      if (!line) {
        flushP();
        continue;
      }
      if (isSubHeading(line)) {
        flushP();
        blocks.push({ type: 'h3', text: line });
        continue;
      }
      buf.push(line);
    }
    flushP();
    return { title: sec.title, blocks };
  });
}

function rebuildTermsFromRaw(raw) {
  const text = normalize(raw);
  const lines = text.split('\n').map((l) => l.trim());
  let i = 0;
  while (i < lines.length && !isMainHeading(lines[i])) i += 1;

  const sections = [];
  while (i < lines.length) {
    const title = lines[i++];
    const contentLines = [];
    while (i < lines.length && !isMainHeading(lines[i])) {
      contentLines.push(lines[i++]);
    }
    sections.push({ title, contentLines });
  }

  return sections.map((sec) => {
    const blocks = [];
    let buf = [];
    const flushP = () => {
      if (buf.length) {
        blocks.push({ type: 'p', text: buf.join(' ') });
        buf = [];
      }
    };

    if (sec.title.startsWith('5.')) {
      const joined = sec.contentLines.filter(Boolean).join(' ');
      const marker = 'You may not upload, offer, request, promote, or use content or conduct that:';
      const idx = joined.indexOf(marker);
      const before = idx >= 0 ? joined.slice(0, idx + marker.length).trim() : joined;
      let rest = idx >= 0 ? joined.slice(idx + marker.length).trim() : '';
      const closingStart = rest.indexOf('ScreenMerch and its fulfillment partners');
      let after = '';
      let listPart = rest;
      if (closingStart >= 0) {
        listPart = rest.slice(0, closingStart).trim();
        after = rest.slice(closingStart).trim();
      }
      const items = listPart
        .split(/;\s+/)
        .map((s) => s.replace(/^or\s+/i, '').replace(/\.\s*$/, '').trim())
        .filter(Boolean);
      blocks.push({ type: 'p', text: before });
      blocks.push({ type: 'ul', items });
      if (after) blocks.push({ type: 'p', text: after });
      return { title: sec.title, blocks };
    }

    // Definitions section: quoted role definitions as bullets
    if (sec.title.startsWith('2.')) {
      for (const line of sec.contentLines) {
        if (!line) {
          flushP();
          continue;
        }
        if (line.startsWith('"') || line.startsWith('"') || /^[""]/.test(line) || line.startsWith('\u201C')) {
          flushP();
          blocks.push({
            type: 'ul',
            items: [line.replace(/^["\u201C]|["\u201D]$/g, (ch, offset, str) => '')],
          });
          // Actually push as list item accumulating
          continue;
        }
        if (/^["“]/.test(line)) {
          flushP();
          // handle below
        }
        buf.push(line);
      }
      // Better rebuild for section 2
      const rebuilt = [];
      let pbuf = [];
      const items = [];
      for (const line of sec.contentLines) {
        if (!line) {
          if (pbuf.length) {
            rebuilt.push({ type: 'p', text: pbuf.join(' ') });
            pbuf = [];
          }
          continue;
        }
        if (/^["“]/.test(line)) {
          if (pbuf.length) {
            rebuilt.push({ type: 'p', text: pbuf.join(' ') });
            pbuf = [];
          }
          items.push(line);
          continue;
        }
        if (items.length) {
          // continuation of previous definition? unlikely - each def is one line
          pbuf.push(line);
        } else {
          pbuf.push(line);
        }
      }
      if (items.length) rebuilt.push({ type: 'ul', items });
      if (pbuf.length) rebuilt.push({ type: 'p', text: pbuf.join(' ') });
      return { title: sec.title, blocks: rebuilt.length ? rebuilt : blocks };
    }

    for (const line of sec.contentLines) {
      if (!line) {
        flushP();
        continue;
      }
      if (isSubHeading(line)) {
        flushP();
        blocks.push({ type: 'h3', text: line });
        continue;
      }
      buf.push(line);
    }
    flushP();
    return { title: sec.title, blocks };
  });
}

// Fix section 2 list merge - definitions should be one ul
function fixDefinitions(sections) {
  return sections.map((sec) => {
    if (!sec.title.startsWith('2.')) return sec;
    const intro = [];
    const defs = [];
    for (const b of sec.blocks) {
      if (b.type === 'p') intro.push(b);
      if (b.type === 'ul') defs.push(...b.items);
    }
    const blocks = [...intro];
    if (defs.length) blocks.push({ type: 'ul', items: defs });
    return { ...sec, blocks };
  });
}

const termsRaw = fs.readFileSync(path.join(__dirname, 'terms_v2.1.txt'), 'utf8');
const privacyRaw = fs.readFileSync(path.join(__dirname, 'privacy_v2.0.txt'), 'utf8');

let termsSections = fixDefinitions(rebuildTermsFromRaw(termsRaw));
let privacySections = rebuildPrivacyFromRaw(privacyRaw);

const termsJsx = renderPage({
  componentName: 'TermsOfService',
  containerClass: 'terms-container',
  contentClass: 'terms-content',
  cssImport: './TermsOfService.css',
  logoImport: '../../assets/screenmerch_logo.png.png',
  h1: 'Terms of Service',
  subtitle: 'Unified terms for creators and customers',
  version: 'Version 2.1',
  effectiveDate: 'August 5, 2026',
  lastUpdated: 'August 5, 2026',
  sections: termsSections,
  navOther: '<Link to="/privacy-policy" className="nav-link">Privacy Policy &rarr;</Link>',
});

const privacyJsx = renderPage({
  componentName: 'PrivacyPolicy',
  containerClass: 'privacy-policy-container',
  contentClass: 'privacy-policy-content',
  cssImport: './PrivacyPolicy.css',
  logoImport: '../../assets/screenmerch_logo.png.png',
  h1: 'Privacy Policy',
  subtitle: 'For visitors, customers, creators, and umbrella participants',
  version: 'Version 2.0',
  effectiveDate: 'August 5, 2026',
  lastUpdated: 'August 5, 2026',
  sections: privacySections,
  navOther: '<Link to="/terms-of-service" className="nav-link">Terms of Service &rarr;</Link>',
});

const termsOut = path.join(ROOT, 'frontend/src/Pages/TermsOfService/TermsOfService.jsx');
const privacyOut = path.join(ROOT, 'frontend/src/Pages/PrivacyPolicy/PrivacyPolicy.jsx');
fs.writeFileSync(termsOut, termsJsx);
fs.writeFileSync(privacyOut, privacyJsx);
console.log('Wrote', termsOut);
console.log('Wrote', privacyOut);
console.log('Terms sections:', termsSections.length);
console.log('Privacy sections:', privacySections.length);

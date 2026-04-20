#!/usr/bin/env python3
"""
UI/UX Pro Max - Design Intelligence Search Engine
Searches through design databases and returns tailored recommendations.
"""

import sys
import os
import json
import re
from pathlib import Path

# Data directory (relative to script location)
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / "data"

def load_csv(filename):
    """Load CSV file and return list of dicts."""
    filepath = DATA_DIR / filename
    if not filepath.exists():
        return []

    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    if not lines:
        return []

    headers = [h.strip() for h in lines[0].split(',')]
    results = []

    for line in lines[1:]:
        values = [v.strip() for v in line.split(',')]
        if len(values) >= len(headers):
            results.append(dict(zip(headers, values)))

    return results

def bm25_score(query_terms, text, k1=1.5, b=0.75):
    """Simple BM25 scoring for relevance ranking."""
    if not text:
        return 0

    text_lower = text.lower()
    score = 0

    for term in query_terms:
        term_lower = term.lower()
        if term_lower in text_lower:
            # Frequency bonus
            freq = text_lower.count(term_lower)
            score += (k1 + 1) * freq / (k1 * ((1 - b) + b * len(text) / 100) + freq)

    return score

def search_domain(query, domain, max_results=10):
    """Search within a specific domain."""
    domain_files = {
        'product': 'product_types.csv',
        'style': 'ui_styles.csv',
        'typography': 'font_pairings.csv',
        'color': 'color_palettes.csv',
        'landing': 'landing_pages.csv',
        'chart': 'chart_types.csv',
        'ux': 'ux_guidelines.csv',
    }

    filename = domain_files.get(domain)
    if not filename:
        return []

    data = load_csv(filename)
    if not data:
        return []

    query_terms = query.lower().split()
    scored = []

    for item in data:
        # Combine searchable fields
        searchable = ' '.join(str(v) for v in item.values())
        score = bm25_score(query_terms, searchable)

        # Regex bonus for exact matches
        for term in query_terms:
            if re.search(r'\b' + re.escape(term) + r'\b', searchable, re.IGNORECASE):
                score += 2

        if score > 0:
            scored.append((score, item))

    # Sort by score descending
    scored.sort(key=lambda x: -x[0])
    return [item for score, item in scored[:max_results]]

def generate_design_system(query, project_name=None):
    """Generate comprehensive design system recommendations."""
    query_terms = query.lower().split()

    # Search across all domains
    results = {
        'product': search_domain(query, 'product', max_results=5),
        'style': search_domain(query, 'style', max_results=5),
        'typography': search_domain(query, 'typography', max_results=3),
        'color': search_domain(query, 'color', max_results=5),
        'ux': search_domain(query, 'ux', max_results=10),
    }

    # Generate recommendations
    output = []
    output.append(f"# Design System: {project_name or 'Untitled Project'}")
    output.append(f"\n**Query:** {query}\n")

    # Product Type
    if results['product']:
        p = results['product'][0]
        output.append("## Product Type")
        output.append(f"- **Type:** {p.get('type', 'General')}")
        output.append(f"- **Industry:** {p.get('industry', 'General')}")
        output.append(f"- **Target Audience:** {p.get('audience', 'General users')}")
        output.append("")

    # Style Recommendations
    if results['style']:
        output.append("## UI Style")
        for i, s in enumerate(results['style'][:3], 1):
            output.append(f"{i}. **{s.get('name', 'Style')}**")
            if s.get('description'):
                output.append(f"   - {s['description']}")
        output.append("")

    # Color Palette
    if results['color']:
        c = results['color'][0]
        output.append("## Color Palette")
        output.append(f"- **Primary:** {c.get('primary', '#000000')}")
        output.append(f"- **Secondary:** {c.get('secondary', '#666666')}")
        output.append(f"- **Accent:** {c.get('accent', '#0066FF')}")
        output.append(f"- **Background:** {c.get('background', '#FFFFFF')}")
        output.append(f"- **Text:** {c.get('text', '#1A1A1A')}")
        output.append("")

    # Typography
    if results['typography']:
        t = results['typography'][0]
        output.append("## Typography")
        output.append(f"- **Heading Font:** {t.get('heading_font', 'System font')}")
        output.append(f"- **Body Font:** {t.get('body_font', 'System font')}")
        output.append(f"- **Google Fonts Import:**")
        output.append(f"   ```css")
        output.append(f"   @import url('https://fonts.googleapis.com/css2?family={t.get('google_import', '')}');")
        output.append(f"   ```")
        output.append("")

    # UX Guidelines
    if results['ux']:
        output.append("## UX Guidelines")
        for u in results['ux'][:5]:
            output.append(f"- **{u.get('rule', 'Guideline')}:** {u.get('description', '')}")
        output.append("")

    # Tech Stack Recommendations
    output.append("## Recommended Tech Stack")
    output.append("- **Framework:** Next.js 14+ (App Router)")
    output.append("- **Styling:** Tailwind CSS")
    output.append("- **Components:** shadcn/ui")
    output.append("- **Icons:** Lucide React")
    output.append("")

    # Accessibility Checklist
    output.append("## Accessibility Checklist")
    output.append("- [ ] Color contrast ≥ 4.5:1 for text")
    output.append("- [ ] Touch targets ≥ 44×44px")
    output.append("- [ ] Keyboard navigation supported")
    output.append("- [ ] ARIA labels for icon buttons")
    output.append("- [ ] Focus states visible")
    output.append("")

    return '\n'.join(output)

def print_results(results, format='ascii'):
    """Print search results in specified format."""
    if not results:
        print("No results found.")
        return

    if format == 'json':
        print(json.dumps(results, indent=2))
        return

    # ASCII box format
    print("\n" + "=" * 60)
    for i, item in enumerate(results, 1):
        print(f"  [{i}] {list(item.values())[0] if item else 'N/A'}")
        for key, value in list(item.items())[1:]:
            if value:
                print(f"      {key}: {value}")
        print("-" * 60)
    print()

def main():
    if len(sys.argv) < 2:
        print("UI/UX Pro Max - Design Intelligence Search")
        print("\nUsage:")
        print('  python3 search.py "<query>" --domain <domain>')
        print('  python3 search.py "<query>" --design-system [-p "Project Name"]')
        print("\nDomains: product, style, typography, color, landing, chart, ux")
        print("\nOptions:")
        print("  --domain <name>     Search specific domain")
        print("  --design-system     Generate comprehensive design system")
        print("  --persist           Save design system to design-system/MASTER.md")
        print("  -p, --project       Project name for design system")
        print("  -n, --max           Maximum results (default: 10)")
        print("  -f, --format        Output format: ascii, json, markdown")
        sys.exit(0)

    query = sys.argv[1]
    domain = None
    design_system = False
    persist = False
    project_name = None
    max_results = 10
    format = 'ascii'

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == '--domain' and i + 1 < len(sys.argv):
            domain = sys.argv[i + 1]
            i += 2
        elif arg == '--design-system':
            design_system = True
            i += 1
        elif arg == '--persist':
            persist = True
            i += 1
        elif arg in ('-p', '--project') and i + 1 < len(sys.argv):
            project_name = sys.argv[i + 1]
            i += 2
        elif arg in ('-n', '--max') and i + 1 < len(sys.argv):
            max_results = int(sys.argv[i + 1])
            i += 2
        elif arg in ('-f', '--format') and i + 1 < len(sys.argv):
            format = sys.argv[i + 1]
            i += 2
        else:
            i += 1

    if design_system:
        output = generate_design_system(query, project_name)
        print(output)

        if persist:
            output_dir = Path('design-system')
            output_dir.mkdir(exist_ok=True)
            output_file = output_dir / 'MASTER.md'
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(output)
            print(f"\n[Saved to {output_file}]")
        return

    if domain:
        results = search_domain(query, domain, max_results)
        print_results(results, format)
    else:
        # Search all domains
        domains = ['product', 'style', 'typography', 'color', 'ux']
        for d in domains:
            results = search_domain(query, d, max_results=3)
            if results:
                print(f"\n## {d.upper()}\n")
                print_results(results, format)

if __name__ == '__main__':
    main()

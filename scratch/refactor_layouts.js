const fs = require('fs');
const path = require('path');

const srcAppDir = path.join(__dirname, '../frontend/src/app');

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDir(fullPath);
    } else if (entry.name === 'page.tsx') {
      processFile(fullPath);
    }
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  if (content.includes('flex min-h-screen') && content.includes('AppSidebar')) {
    console.log('Processing', filePath);
    
    // Remove import AppSidebar
    content = content.replace(/import\s+{\s*AppSidebar\s*}\s+from\s+['"]@\/components\/app-sidebar['"];?\n?/, '');
    
    // Replace AuthGuard with AuthenticatedLayout if not already done
    if (!content.includes('import { AuthenticatedLayout }')) {
      if (content.includes('AuthGuard')) {
        content = content.replace(/import\s+{\s*AuthGuard\s*}\s+from\s+['"]@\/components\/auth\/auth-guard['"];?\n?/, 'import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";\n');
      } else {
        content = content.replace(/(import .*;\n)(?!import)/, '$1import { AuthenticatedLayout } from "@/components/layout/authenticated-layout";\n');
      }
    }

    // Replace the opening wrappers
    content = content.replace(/<AuthGuard>\s*<div[^>]*className=["'][^"']*flex min-h-screen[^"']*["'][^>]*>\s*<AppSidebar\s*\/>\s*<main[^>]*>\s*(?:<div[^>]*className=["']p-8(?:[^"']*)["'][^>]*>)?/g, '<AuthenticatedLayout>\n      <>');
    content = content.replace(/<AuthenticatedLayout>\s*<div[^>]*className=["'][^"']*flex min-h-screen[^"']*["'][^>]*>\s*<AppSidebar\s*\/>\s*<main[^>]*>\s*(?:<div[^>]*className=["']p-8(?:[^"']*)["'][^>]*>)?/g, '<AuthenticatedLayout>\n      <>');
    content = content.replace(/<div[^>]*className=["'][^"']*flex min-h-screen[^"']*["'][^>]*>\s*<AppSidebar\s*\/>\s*<main[^>]*>\s*(?:<div[^>]*className=["']p-8(?:[^"']*)["'][^>]*>)?/g, '<AuthenticatedLayout>\n      <>');

    // Replace closing wrappers
    content = content.replace(/<\/div>\s*<\/main>\s*<\/div>\s*<\/AuthGuard>/g, '</>\n    </AuthenticatedLayout>');
    content = content.replace(/<\/div>\s*<\/main>\s*<\/div>/g, '</>\n    </AuthenticatedLayout>');
    content = content.replace(/<\/main>\s*<\/div>\s*<\/AuthGuard>/g, '</>\n    </AuthenticatedLayout>');
    content = content.replace(/<\/main>\s*<\/div>/g, '</>\n    </AuthenticatedLayout>');
    
    // Replace remaining AuthGuard
    content = content.replace(/<AuthGuard>/g, '<AuthenticatedLayout>');
    content = content.replace(/<\/AuthGuard>/g, '</AuthenticatedLayout>');

    fs.writeFileSync(filePath, content, 'utf-8');
  }
}

processDir(srcAppDir);

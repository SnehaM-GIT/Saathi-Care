const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'public', 'index.html');
const outputPath = path.join(__dirname, 'db_backup', 'page_content.txt');

try {
  const html = fs.readFileSync(htmlPath, 'utf8');
  
  // Remove script and style blocks
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Replace typical block elements with newlines to keep formatting somewhat readable
  text = text.replace(/<\/(div|p|h1|h2|h3|h4|h5|h6|li|section)>/gi, '\n');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");

  // Clean up extra whitespace and blank lines
  text = text.split('\n')
             .map(line => line.replace(/\s+/g, ' ').trim())
             .filter(line => line.length > 0)
             .join('\n\n');

  fs.writeFileSync(outputPath, text);
  console.log('Successfully scraped website content to ' + outputPath);
} catch (error) {
  console.error('Error scraping content:', error);
}

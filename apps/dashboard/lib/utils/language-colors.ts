// GitHub language colors mapping
// Source: https://github.com/ozh/github-colors

export function getLanguageColor(language: string | null): string {
  if (!language) return '#8B949E'; // Default gray color

  const colors: Record<string, string> = {
    'JavaScript': '#F1E05A',
    'TypeScript': '#3178C6',
    'Python': '#3572A5',
    'Java': '#B07219',
    'C': '#555555',
    'C++': '#F34B7D',
    'C#': '#178600',
    'PHP': '#4F5D95',
    'Ruby': '#701516',
    'Go': '#00ADD8',
    'Rust': '#DEA584',
    'Swift': '#F05138',
    'Kotlin': '#A97BFF',
    'Dart': '#00B4AB',
    'Shell': '#89E051',
    'HTML': '#E34C26',
    'CSS': '#563D7C',
    'SCSS': '#C6538C',
    'Vue': '#41B883',
    'React': '#61DAFB',
    'Svelte': '#FF3E00',
    'Angular': '#DD0031',
    'Elixir': '#6E4A7E',
    'Haskell': '#5E5086',
    'Scala': '#C22D40',
    'Clojure': '#DB5855',
    'Erlang': '#B83998',
    'R': '#198CE7',
    'MATLAB': '#E16737',
    'Lua': '#000080',
    'Perl': '#0298C3',
    'PowerShell': '#012456',
    'Objective-C': '#438EFF',
    'OCaml': '#3BE133',
    'Vim script': '#199F4B',
    'Assembly': '#6E4C13',
    'Makefile': '#427819',
    'Dockerfile': '#384D54',
    'YAML': '#CB171E',
    'JSON': '#292929',
    'Markdown': '#083FA1',
    'SQL': '#E38C00',
  };

  return colors[language] || '#8B949E';
}

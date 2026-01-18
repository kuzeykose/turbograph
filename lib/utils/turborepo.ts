export interface PackageInfo {
  name: string;
  path: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface TurborepoStructure {
  isTurborepo: boolean;
  apps: PackageInfo[];
  packages: PackageInfo[];
  workspacePackages: Set<string>;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'dependency' | 'devDependency';
}

/**
 * Check if a repository is a Turborepo by looking for turbo.json
 */
export async function checkIsTurborepo(
  owner: string,
  repo: string,
  token: string
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/turbo.json`,
      { headers }
    );
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch and parse package.json from a specific path
 */
async function fetchPackageJson(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<PackageInfo | null> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}/package.json`,
      { headers }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    if (data.encoding === 'base64' && data.content) {
      const decodedContent = atob(data.content.replace(/\n/g, ''));
      const packageJson = JSON.parse(decodedContent);
      
      return {
        name: packageJson.name || path.split('/').pop() || 'unknown',
        path,
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching package.json from ${path}:`, error);
    return null;
  }
}

/**
 * Fetch all folders in a directory
 */
async function fetchFolders(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<string[]> {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }

    return data
      .filter((item: any) => item.type === 'dir')
      .map((item: any) => item.path);
  } catch (error) {
    console.error(`Error fetching folders from ${path}:`, error);
    return [];
  }
}

/**
 * Analyze Turborepo structure and dependencies
 */
export async function analyzeTurborepo(
  owner: string,
  repo: string,
  token: string
): Promise<TurborepoStructure> {
  const isTurborepo = await checkIsTurborepo(owner, repo, token);
  
  if (!isTurborepo) {
    return {
      isTurborepo: false,
      apps: [],
      packages: [],
      workspacePackages: new Set(),
    };
  }

  // Fetch apps and packages folders
  const [appFolders, packageFolders] = await Promise.all([
    fetchFolders(owner, repo, 'apps', token),
    fetchFolders(owner, repo, 'packages', token),
  ]);

  // Fetch all package.json files
  const [apps, packages] = await Promise.all([
    Promise.all(
      appFolders.map((folder) => fetchPackageJson(owner, repo, folder, token))
    ),
    Promise.all(
      packageFolders.map((folder) => fetchPackageJson(owner, repo, folder, token))
    ),
  ]);

  // Filter out null results
  const validApps = apps.filter((app): app is PackageInfo => app !== null);
  const validPackages = packages.filter((pkg): pkg is PackageInfo => pkg !== null);

  // Create a set of workspace package names
  const workspacePackages = new Set<string>(
    [...validApps, ...validPackages].map((pkg) => pkg.name)
  );

  return {
    isTurborepo: true,
    apps: validApps,
    packages: validPackages,
    workspacePackages,
  };
}

/**
 * Build dependency graph from Turborepo structure
 */
export function buildDependencyGraph(structure: TurborepoStructure): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  
  // Check which apps depend on which packages
  for (const app of structure.apps) {
    // Check regular dependencies
    for (const [depName, depVersion] of Object.entries(app.dependencies)) {
      if (structure.workspacePackages.has(depName)) {
        edges.push({
          from: app.name,
          to: depName,
          type: 'dependency',
        });
      }
    }
    
    // Check dev dependencies
    for (const [depName, depVersion] of Object.entries(app.devDependencies)) {
      if (structure.workspacePackages.has(depName)) {
        edges.push({
          from: app.name,
          to: depName,
          type: 'devDependency',
        });
      }
    }
  }
  
  // Also check if packages depend on other packages
  for (const pkg of structure.packages) {
    for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
      if (structure.workspacePackages.has(depName)) {
        edges.push({
          from: pkg.name,
          to: depName,
          type: 'dependency',
        });
      }
    }
    
    for (const [depName, depVersion] of Object.entries(pkg.devDependencies)) {
      if (structure.workspacePackages.has(depName)) {
        edges.push({
          from: pkg.name,
          to: depName,
          type: 'devDependency',
        });
      }
    }
  }
  
  return edges;
}

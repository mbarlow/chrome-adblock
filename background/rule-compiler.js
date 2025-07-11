// Chrome AdBlock - Rule Compiler
// Processes and optimizes filter lists for efficient blocking

class RuleCompiler {
  constructor() {
    this.compiledRules = [];
    this.optimizationStats = {
      originalRules: 0,
      optimizedRules: 0,
      duplicatesRemoved: 0,
      invalidRules: 0
    };
  }

  // Compile filter list text to structured rules
  async compileFilterList(filterText, listName = 'unknown') {
    console.log(`RuleCompiler: Compiling filter list: ${listName}`);

    const lines = filterText.split('\n');
    const rules = [];
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const rule = this.parseLine(line.trim(), listName, lineNumber);
      if (rule) {
        rules.push(rule);
      }
    }

    this.optimizationStats.originalRules += rules.length;
    console.log(`RuleCompiler: Parsed ${rules.length} rules from ${listName}`);

    return rules;
  }

  // Parse individual filter line
  parseLine(line, listName, lineNumber) {
    // Skip empty lines and comments
    if (!line || line.startsWith('!') || line.startsWith('[')) {
      return null;
    }

    try {
      // Handle different rule types
      if (line.includes('##')) {
        return this.parseElementHidingRule(line, listName, lineNumber);
      } else if (line.includes('#@#')) {
        return this.parseElementUnhidingRule(line, listName, lineNumber);
      } else if (line.includes('#?#')) {
        return this.parseProceduralRule(line, listName, lineNumber);
      } else {
        return this.parseNetworkRule(line, listName, lineNumber);
      }
    } catch (error) {
      console.warn(`RuleCompiler: Error parsing line ${lineNumber} in ${listName}:`, line, error);
      this.optimizationStats.invalidRules++;
      return null;
    }
  }

  // Parse network filtering rules
  parseNetworkRule(line, listName, lineNumber) {
    let filter = line;
    let options = '';
    let action = 'block';

    // Handle exception rules (whitelist)
    if (filter.startsWith('@@')) {
      action = 'allow';
      filter = filter.slice(2);
    }

    // Split filter and options
    const dollarIndex = filter.indexOf('$');
    if (dollarIndex !== -1) {
      options = filter.slice(dollarIndex + 1);
      filter = filter.slice(0, dollarIndex);
    }

    // Parse options
    const parsedOptions = this.parseOptions(options);

    // Determine URL filter type
    const urlFilter = this.createUrlFilter(filter);
    if (!urlFilter) {
      return null;
    }

    return {
      id: this.generateRuleId(),
      type: 'network',
      action: action,
      filter: filter,
      urlFilter: urlFilter,
      options: parsedOptions,
      source: listName,
      lineNumber: lineNumber,
      priority: this.calculatePriority(action, parsedOptions)
    };
  }

  // Parse element hiding rules (cosmetic filters)
  parseElementHidingRule(line, listName, lineNumber) {
    const [domains, selector] = line.split('##');

    return {
      id: this.generateRuleId(),
      type: 'cosmetic',
      action: 'hide',
      domains: domains ? this.parseDomains(domains) : [],
      selector: selector,
      source: listName,
      lineNumber: lineNumber
    };
  }

  // Parse element unhiding rules
  parseElementUnhidingRule(line, listName, lineNumber) {
    const [domains, selector] = line.split('#@#');

    return {
      id: this.generateRuleId(),
      type: 'cosmetic',
      action: 'unhide',
      domains: domains ? this.parseDomains(domains) : [],
      selector: selector,
      source: listName,
      lineNumber: lineNumber
    };
  }

  // Parse procedural cosmetic rules
  parseProceduralRule(line, listName, lineNumber) {
    const [domains, selector] = line.split('#?#');

    return {
      id: this.generateRuleId(),
      type: 'procedural',
      action: 'hide',
      domains: domains ? this.parseDomains(domains) : [],
      selector: selector,
      source: listName,
      lineNumber: lineNumber
    };
  }

  // Parse filter options
  parseOptions(optionsString) {
    if (!optionsString) return {};

    const options = {};
    const parts = optionsString.split(',');

    for (const part of parts) {
      const trimmed = part.trim();

      if (trimmed.startsWith('domain=')) {
        options.domains = this.parseDomains(trimmed.slice(7));
      } else if (trimmed === 'third-party' || trimmed === '3p') {
        options.thirdParty = true;
      } else if (trimmed === '~third-party' || trimmed === '~3p') {
        options.thirdParty = false;
      } else if (trimmed === 'important') {
        options.important = true;
      } else if (this.isResourceType(trimmed)) {
        if (!options.resourceTypes) options.resourceTypes = [];
        options.resourceTypes.push(this.mapResourceType(trimmed));
      } else if (trimmed.startsWith('~') && this.isResourceType(trimmed.slice(1))) {
        if (!options.excludedResourceTypes) options.excludedResourceTypes = [];
        options.excludedResourceTypes.push(this.mapResourceType(trimmed.slice(1)));
      }
    }

    return options;
  }

  // Parse domain lists
  parseDomains(domainString) {
    return domainString.split('|').map(d => d.trim()).filter(d => d);
  }

  // Create URL filter for declarative net request
  createUrlFilter(filter) {
    // Handle different filter patterns
    if (filter.startsWith('||') && filter.endsWith('^')) {
      // Domain blocking: ||example.com^
      const domain = filter.slice(2, -1);
      return {
        type: 'domain',
        value: domain,
        regexFilter: `^[^:]+://([^/]+\\.)?${this.escapeRegex(domain)}/.*`
      };
    } else if (filter.startsWith('||')) {
      // Domain prefix: ||example.com
      const domain = filter.slice(2);
      return {
        type: 'domain_prefix',
        value: domain,
        urlFilter: `*://*.${domain}/*`
      };
    } else if (filter.startsWith('|')) {
      // Start anchor: |http://example.com
      return {
        type: 'start_anchor',
        value: filter.slice(1),
        urlFilter: filter.slice(1) + '*'
      };
    } else if (filter.endsWith('|')) {
      // End anchor: example.com/path|
      return {
        type: 'end_anchor',
        value: filter.slice(0, -1),
        urlFilter: '*' + filter.slice(0, -1)
      };
    } else if (filter.includes('*')) {
      // Wildcard pattern
      return {
        type: 'wildcard',
        value: filter,
        urlFilter: filter
      };
    } else if (this.isRegexPattern(filter)) {
      // Regex pattern
      return {
        type: 'regex',
        value: filter,
        regexFilter: filter
      };
    } else {
      // Plain text substring
      return {
        type: 'substring',
        value: filter,
        urlFilter: '*' + filter + '*'
      };
    }
  }

  // Check if resource type is valid
  isResourceType(type) {
    const validTypes = [
      'script', 'image', 'stylesheet', 'object', 'xmlhttprequest',
      'subdocument', 'document', 'media', 'font', 'websocket',
      'ping', 'other', 'main_frame', 'sub_frame'
    ];
    return validTypes.includes(type);
  }

  // Map filter resource types to Chrome types
  mapResourceType(type) {
    const mapping = {
      'script': 'script',
      'image': 'image',
      'stylesheet': 'stylesheet',
      'object': 'object',
      'xmlhttprequest': 'xmlhttprequest',
      'subdocument': 'sub_frame',
      'document': 'main_frame',
      'media': 'media',
      'font': 'font',
      'websocket': 'websocket',
      'ping': 'ping',
      'other': 'other'
    };
    return mapping[type] || type;
  }

  // Calculate rule priority
  calculatePriority(action, options) {
    let priority = 1;

    if (action === 'allow') {
      priority += 10000; // Whitelist rules have higher priority
    }

    if (options.important) {
      priority += 1000;
    }

    if (options.domains && options.domains.length > 0) {
      priority += 100; // Domain-specific rules
    }

    if (options.resourceTypes && options.resourceTypes.length === 1) {
      priority += 10; // Specific resource type
    }

    return priority;
  }

  // Check if pattern is regex
  isRegexPattern(pattern) {
    // Simple heuristic for regex patterns
    const regexChars = /[\[\]{}().*+?^$|\\]/;
    return regexChars.test(pattern) && !pattern.includes('*');
  }

  // Escape regex special characters
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Generate unique rule ID
  generateRuleId() {
    return Date.now() + Math.random();
  }

  // Optimize compiled rules
  optimizeRules(rules) {
    console.log(`RuleCompiler: Optimizing ${rules.length} rules...`);

    // Remove duplicates
    const uniqueRules = this.removeDuplicates(rules);

    // Sort by priority
    uniqueRules.sort((a, b) => (b.priority || 1) - (a.priority || 1));

    // Combine similar rules
    const combinedRules = this.combineRules(uniqueRules);

    // Remove redundant rules
    const finalRules = this.removeRedundantRules(combinedRules);

    this.optimizationStats.optimizedRules = finalRules.length;
    this.optimizationStats.duplicatesRemoved = rules.length - uniqueRules.length;

    console.log(`RuleCompiler: Optimization complete. ${finalRules.length} rules remaining.`);

    return finalRules;
  }

  // Remove duplicate rules
  removeDuplicates(rules) {
    const seen = new Set();
    const unique = [];

    for (const rule of rules) {
      const key = this.getRuleKey(rule);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(rule);
      }
    }

    return unique;
  }

  // Generate key for rule deduplication
  getRuleKey(rule) {
    if (rule.type === 'network') {
      return `${rule.action}:${rule.filter}:${JSON.stringify(rule.options)}`;
    } else if (rule.type === 'cosmetic') {
      return `${rule.action}:${rule.selector}:${rule.domains?.join(',')}`;
    }
    return JSON.stringify(rule);
  }

  // Combine similar rules for efficiency
  combineRules(rules) {
    // Group rules by similar patterns
    const groups = new Map();

    for (const rule of rules) {
      if (rule.type === 'network' && rule.urlFilter?.type === 'domain') {
        const key = `domain:${rule.action}:${JSON.stringify(rule.options)}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key).push(rule);
      }
    }

    const combined = [...rules];

    // Combine domain rules into single rules with multiple domains
    for (const [key, group] of groups) {
      if (group.length > 1) {
        const domains = group.map(r => r.urlFilter.value);
        const combinedRule = {
          ...group[0],
          urlFilter: {
            type: 'domains',
            values: domains
          }
        };

        // Remove individual rules and add combined rule
        for (const rule of group) {
          const index = combined.indexOf(rule);
          if (index > -1) {
            combined.splice(index, 1);
          }
        }
        combined.push(combinedRule);
      }
    }

    return combined;
  }

  // Remove redundant rules
  removeRedundantRules(rules) {
    const filtered = [];

    for (const rule of rules) {
      let isRedundant = false;

      // Check if this rule is made redundant by a broader rule
      for (const other of filtered) {
        if (this.isRuleRedundant(rule, other)) {
          isRedundant = true;
          break;
        }
      }

      if (!isRedundant) {
        filtered.push(rule);
      }
    }

    return filtered;
  }

  // Check if one rule makes another redundant
  isRuleRedundant(rule, other) {
    // Same action and other is more general
    if (rule.action === other.action && rule.type === other.type) {
      if (rule.type === 'network') {
        // Check if other rule covers this rule's pattern
        return this.isPatternCovered(rule.filter, other.filter);
      }
    }
    return false;
  }

  // Check if one pattern covers another
  isPatternCovered(specific, general) {
    // Simple coverage check
    if (general.includes('*') && !specific.includes('*')) {
      const generalPattern = general.replace(/\*/g, '.*');
      try {
        const regex = new RegExp(generalPattern);
        return regex.test(specific);
      } catch {
        return false;
      }
    }
    return false;
  }

  // Convert optimized rules to declarative net request format
  toDeclarativeNetRequest(rules) {
    const dnrRules = [];
    let ruleId = 1;

    for (const rule of rules) {
      if (rule.type === 'network') {
        const dnrRule = {
          id: ruleId++,
          priority: rule.priority || 1,
          action: { type: rule.action },
          condition: {}
        };

        // Set URL filter
        if (rule.urlFilter) {
          if (rule.urlFilter.urlFilter) {
            dnrRule.condition.urlFilter = rule.urlFilter.urlFilter;
          } else if (rule.urlFilter.regexFilter) {
            dnrRule.condition.regexFilter = rule.urlFilter.regexFilter;
          } else if (rule.urlFilter.type === 'domains') {
            dnrRule.condition.requestDomains = rule.urlFilter.values;
          } else if (rule.urlFilter.type === 'domain') {
            dnrRule.condition.requestDomains = [rule.urlFilter.value];
          }
        }

        // Set resource types
        if (rule.options.resourceTypes) {
          dnrRule.condition.resourceTypes = rule.options.resourceTypes;
        }

        // Set domain conditions
        if (rule.options.domains) {
          dnrRule.condition.initiatorDomains = rule.options.domains;
        }

        // Set third-party condition
        if (rule.options.thirdParty !== undefined) {
          dnrRule.condition.domainType = rule.options.thirdParty ? 'thirdParty' : 'firstParty';
        }

        dnrRules.push(dnrRule);
      }
    }

    return dnrRules;
  }

  // Get compilation statistics
  getStats() {
    return { ...this.optimizationStats };
  }

  // Reset statistics
  resetStats() {
    this.optimizationStats = {
      originalRules: 0,
      optimizedRules: 0,
      duplicatesRemoved: 0,
      invalidRules: 0
    };
  }
}

// Export as global for service worker
window.ruleCompiler = new RuleCompiler();

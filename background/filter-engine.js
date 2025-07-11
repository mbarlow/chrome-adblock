// Chrome AdBlock - Filter Engine
// Core filtering logic for ad blocking using Declarative Net Request API

class FilterEngine {
  constructor() {
    this.rules = [];
    this.ruleId = 1;
    this.whitelist = [];
    this.customRules = [];
    this.isInitialized = false;
  }

  async initialize() {
    console.log('FilterEngine: Initializing...');

    try {
      // Load existing rules from storage
      await this.loadRules();

      // Load whitelist
      await this.loadWhitelist();

      // Load custom rules
      await this.loadCustomRules();

      // Compile and register rules
      await this.compileAndRegisterRules();

      this.isInitialized = true;
      console.log('FilterEngine: Initialization complete');
    } catch (error) {
      console.error('FilterEngine: Initialization failed:', error);
      throw error;
    }
  }

  async loadRules() {
    try {
      // Load default rules from JSON file
      const response = await fetch(chrome.runtime.getURL('filters/default-rules.json'));
      const defaultRules = await response.json();

      // Load filter sources
      const sourcesResponse = await fetch(chrome.runtime.getURL('assets/blocklist-sources.json'));
      const sources = await sourcesResponse.json();

      this.rules = defaultRules.rules || [];
      console.log(`FilterEngine: Loaded ${this.rules.length} default rules`);
    } catch (error) {
      console.error('FilterEngine: Error loading rules:', error);
      this.rules = [];
    }
  }

  async loadWhitelist() {
    try {
      const result = await chrome.storage.sync.get(['whitelist']);
      this.whitelist = result.whitelist || [];
      console.log(`FilterEngine: Loaded ${this.whitelist.length} whitelisted domains`);
    } catch (error) {
      console.error('FilterEngine: Error loading whitelist:', error);
      this.whitelist = [];
    }
  }

  async loadCustomRules() {
    try {
      const result = await chrome.storage.sync.get(['customRules']);
      this.customRules = result.customRules || [];
      console.log(`FilterEngine: Loaded ${this.customRules.length} custom rules`);
    } catch (error) {
      console.error('FilterEngine: Error loading custom rules:', error);
      this.customRules = [];
    }
  }

  async compileAndRegisterRules() {
    try {
      // Clear existing dynamic rules
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);

      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
      }

      // Compile rules to declarative net request format
      const compiledRules = await this.compileRules();

      // Register rules in batches (Chrome has limits)
      const batchSize = 5000;
      for (let i = 0; i < compiledRules.length; i += batchSize) {
        const batch = compiledRules.slice(i, i + batchSize);
        await chrome.declarativeNetRequest.updateDynamicRules({
          addRules: batch
        });
      }

      console.log(`FilterEngine: Registered ${compiledRules.length} rules`);
    } catch (error) {
      console.error('FilterEngine: Error compiling/registering rules:', error);
      throw error;
    }
  }

  async compileRules() {
    const compiledRules = [];
    let ruleId = 1;

    // Process blocking rules
    for (const rule of this.rules) {
      if (rule.action === 'block') {
        const compiledRule = this.compileBlockingRule(rule, ruleId++);
        if (compiledRule && !this.isWhitelisted(compiledRule)) {
          compiledRules.push(compiledRule);
        }
      }
    }

    // Process custom rules
    for (const rule of this.customRules) {
      const compiledRule = this.compileCustomRule(rule, ruleId++);
      if (compiledRule && !this.isWhitelisted(compiledRule)) {
        compiledRules.push(compiledRule);
      }
    }

    // Add whitelist rules (these should have higher priority)
    for (const domain of this.whitelist) {
      compiledRules.push({
        id: ruleId++,
        priority: 10000, // High priority for whitelist
        action: { type: 'allow' },
        condition: {
          requestDomains: [domain],
          resourceTypes: ['main_frame', 'sub_frame']
        }
      });
    }

    return compiledRules;
  }

  compileBlockingRule(rule, id) {
    try {
      const compiledRule = {
        id: id,
        priority: rule.priority || 1,
        action: { type: 'block' },
        condition: {}
      };

      // Handle URL filters
      if (rule.urlFilter) {
        compiledRule.condition.urlFilter = rule.urlFilter;
      }

      // Handle regex filters
      if (rule.regexFilter) {
        compiledRule.condition.regexFilter = rule.regexFilter;
      }

      // Handle domain lists
      if (rule.domains) {
        compiledRule.condition.requestDomains = rule.domains;
      }

      // Handle resource types
      if (rule.resourceTypes) {
        compiledRule.condition.resourceTypes = rule.resourceTypes;
      } else {
        // Default resource types for ads
        compiledRule.condition.resourceTypes = [
          'script',
          'image',
          'stylesheet',
          'sub_frame',
          'xmlhttprequest',
          'media'
        ];
      }

      // Handle request methods
      if (rule.requestMethods) {
        compiledRule.condition.requestMethods = rule.requestMethods;
      }

      return compiledRule;
    } catch (error) {
      console.error('FilterEngine: Error compiling blocking rule:', error, rule);
      return null;
    }
  }

  compileCustomRule(rule, id) {
    try {
      const compiledRule = {
        id: id,
        priority: rule.priority || 100,
        action: { type: rule.action || 'block' },
        condition: {}
      };

      // Parse custom rule format (similar to uBlock Origin)
      if (rule.filter) {
        // Simple domain blocking
        if (rule.filter.startsWith('||') && rule.filter.endsWith('^')) {
          const domain = rule.filter.slice(2, -1);
          compiledRule.condition.requestDomains = [domain];
        }
        // URL pattern
        else if (rule.filter.includes('*')) {
          compiledRule.condition.urlFilter = rule.filter.replace(/\*/g, '*');
        }
        // Exact URL
        else {
          compiledRule.condition.urlFilter = rule.filter;
        }
      }

      // Handle options
      if (rule.options) {
        const options = rule.options.split(',');
        for (const option of options) {
          const [key, value] = option.split('=');
          switch (key.trim()) {
            case 'domain':
              compiledRule.condition.initiatorDomains = [value];
              break;
            case 'third-party':
              compiledRule.condition.domainType = 'thirdParty';
              break;
            case 'script':
              compiledRule.condition.resourceTypes = ['script'];
              break;
            case 'image':
              compiledRule.condition.resourceTypes = ['image'];
              break;
            case 'stylesheet':
              compiledRule.condition.resourceTypes = ['stylesheet'];
              break;
          }
        }
      }

      return compiledRule;
    } catch (error) {
      console.error('FilterEngine: Error compiling custom rule:', error, rule);
      return null;
    }
  }

  isWhitelisted(rule) {
    // Check if rule affects whitelisted domains
    if (rule.condition.requestDomains) {
      return rule.condition.requestDomains.some(domain =>
        this.whitelist.includes(domain)
      );
    }
    return false;
  }

  async enableRules() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Rules are automatically enabled when registered
    console.log('FilterEngine: Rules enabled');
  }

  async disableRules() {
    try {
      // Remove all dynamic rules to disable blocking
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = existingRules.map(rule => rule.id);

      if (ruleIds.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds
        });
      }

      console.log('FilterEngine: Rules disabled');
    } catch (error) {
      console.error('FilterEngine: Error disabling rules:', error);
    }
  }

  async updateWhitelist(newWhitelist) {
    this.whitelist = newWhitelist;
    await chrome.storage.sync.set({ whitelist: newWhitelist });

    // Recompile and register rules with new whitelist
    await this.compileAndRegisterRules();

    console.log('FilterEngine: Whitelist updated');
  }

  async updateCustomRules(newRules) {
    this.customRules = newRules;
    await chrome.storage.sync.set({ customRules: newRules });

    // Recompile and register rules with new custom rules
    await this.compileAndRegisterRules();

    console.log('FilterEngine: Custom rules updated');
  }

  async addCustomRule(ruleText) {
    try {
      const rule = this.parseCustomRule(ruleText);
      if (rule) {
        this.customRules.push(rule);
        await this.updateCustomRules(this.customRules);
        return true;
      }
      return false;
    } catch (error) {
      console.error('FilterEngine: Error adding custom rule:', error);
      return false;
    }
  }

  parseCustomRule(ruleText) {
    // Parse uBlock Origin style rules
    const trimmed = ruleText.trim();

    // Skip comments
    if (trimmed.startsWith('!') || trimmed.startsWith('#')) {
      return null;
    }

    // Handle blocking rules
    if (trimmed.includes('##')) {
      // Cosmetic filter (element hiding)
      const [domains, selector] = trimmed.split('##');
      return {
        type: 'cosmetic',
        domains: domains ? domains.split(',') : [],
        selector: selector,
        action: 'hide'
      };
    }

    // Handle network filters
    let [filter, options] = trimmed.split('$');

    // Determine action
    let action = 'block';
    if (filter.startsWith('@@')) {
      action = 'allow';
      filter = filter.slice(2);
    }

    return {
      type: 'network',
      filter: filter,
      options: options || '',
      action: action
    };
  }

  async getStatistics() {
    try {
      const rules = await chrome.declarativeNetRequest.getDynamicRules();
      return {
        totalRules: rules.length,
        defaultRules: this.rules.length,
        customRules: this.customRules.length,
        whitelistedDomains: this.whitelist.length
      };
    } catch (error) {
      console.error('FilterEngine: Error getting statistics:', error);
      return {
        totalRules: 0,
        defaultRules: this.rules.length,
        customRules: this.customRules.length,
        whitelistedDomains: this.whitelist.length
      };
    }
  }

  async refreshRules() {
    console.log('FilterEngine: Refreshing rules...');
    await this.loadRules();
    await this.compileAndRegisterRules();
    console.log('FilterEngine: Rules refreshed');
  }
}

// Export as global for service worker
window.filterEngine = new FilterEngine();

---
name: skill-creator
description: Expert skill creator for Claude Code and Cursor. Use when creating new skills, commands, or improving existing ones. Follows best practices from official documentation.
user_invocable: true
metadata:
  tags: skills, meta, templates, cursor, claude-code, documentation
---

## When to use

Use this skill whenever you need to:
- Create a new skill for Claude Code or Cursor
- Improve or refactor an existing skill
- Understand skill structure and best practices
- Generate skill templates with proper formatting

## Instructions

### Critical Decision: Single File vs Multi-file

**FIRST**: Determine if the skill should be single-file or multi-file:

**Use MULTI-FILE (rules/ folder) when:**
- ✅ Skill covers a complex domain (e.g., framework, library, methodology)
- ✅ Has multiple independent topics/sub-domains
- ✅ Documentation would exceed 300 lines
- ✅ Topics can be referenced separately
- ✅ Similar to: remotion-best-practices, react-best-practices

**Use SINGLE FILE when:**
- Task is focused and specific (e.g., "add JSDoc comments")
- Documentation is under 200 lines
- Everything is tightly coupled in one workflow

### For Multi-file Skills (RECOMMENDED for most skills):

1. **Create directory structure:**
   ```
   skill-name/
     SKILL.md          # Index with links
     rules/
       topic1.md
       topic2.md
   ```

2. **SKILL.md contains:**
   - Brief "When to use"
   - List of topics with links: `[rules/topic.md](rules/topic.md)`
   - NO detailed documentation (just navigation)

3. **Each rules/*.md contains:**
   - YAML frontmatter (name, description, tags)
   - Focused content on ONE topic
   - Concrete code examples
   - Constraints (❌ forbidden, ✅ required)

4. **Benefits:**
   - Claude loads only relevant sections
   - Easier maintenance
   - Better organization
   - Scalable and modular

### For Single-file Skills:

Use the template below with all content in SKILL.md.

## Skill Formats

### Claude Code (SKILL.md)

Claude Code skills use YAML frontmatter + markdown format:

```markdown
---
name: skill-name-kebab-case
description: Clear description that helps Claude decide when to load. Use when [specific context].
user_invocable: true
metadata:
  tags: tag1, tag2, tag3
---

## When to use

[Specific, verifiable criteria for when this skill should be invoked]

## Instructions

[Clear, actionable step-by-step instructions for the LLM]

## Examples

[Concrete examples with input/output]

## Constraints

[What NOT to do - forbidden patterns or anti-patterns]
```

**Key Guidelines:**
- `name`: kebab-case, descriptive, unique
- `description`: Must help Claude decide WHEN to load (context-specific)
- `user_invocable: true`: Allows manual invocation via /skill-name
- `tags`: Comma-separated, relevant keywords

### Cursor Commands (.cursorrules or .cursor/commands/)

Cursor uses markdown-only format (no frontmatter):

```markdown
# Command Name

## Objective
[Detailed explanation of the task and expected outcome]

## Requirements
- Specific requirement or constraint 1
- Coding standard to follow
- Expected format or structure

## Context
[When and why this command should be used]

## Instructions

1. **Step Name**: Clear, actionable instruction
   - Sub-step if needed

2. **Step Name**: Clear, actionable instruction

## Examples

### Example 1: Use Case Name

**Input**:
```
[Example input]
```

**Expected Output**:
```
[Example output]
```

## Edge Cases
- How to handle edge case 1
- How to handle edge case 2
```

## Best Practices for Skill Creation

### 1. Clear Invocation Criteria

❌ **Bad**: "Use when working with React"
✅ **Good**: "Use when creating React components with TypeScript, Material-UI, and form validation"

### 2. Specific Instructions

❌ **Bad**: "Write good code"
✅ **Good**: "Use functional components with TypeScript. Define prop types with interfaces. Handle loading and error states explicitly."

### 3. Concrete Examples

Always include:
- Real-world input examples
- Expected output with actual code
- Edge cases and how to handle them

### 4. Success Criteria

Make it verifiable:
- [ ] Code compiles without errors
- [ ] All TypeScript types are properly defined
- [ ] Tests pass
- [ ] Follows project conventions

### 5. Constraints and Anti-patterns

Explicitly state what NOT to do:
- ❌ Never use `any` type
- ❌ Avoid class components
- ✅ Always use const for components

### 6. Uncertainty Handling

Tell the LLM when to ask questions:
- "If the component needs state management, ask whether to use Context or props"
- "When multiple approaches are valid, present options with trade-offs"

## Skill Organization Patterns

### IMPORTANT: When to Use Multi-file Structure

**✅ Use multi-file (with rules/ folder) when:**
- Skill covers a complex domain with multiple sub-topics
- Documentation would be > 300 lines in a single file
- Topics are independent and can be referenced separately
- You want Claude to load only relevant sections (performance)
- Easier maintenance and updates

**❌ Use single file when:**
- Skill is focused on one specific task
- Documentation is < 200 lines
- All content is tightly coupled

### Simple Skill (Single File)

For focused, specific tasks:
```
skill-name/
  SKILL.md
```

**Example**: `add-jsdoc-comments` - one clear task, simple workflow

### Complex Skill (Multi-file) ⭐ RECOMMENDED FOR MOST SKILLS

For domain-specific knowledge with multiple sub-topics:

```
skill-name/
  SKILL.md           # Index/guide with links to rules
  rules/
    topic-1.md       # Focused sub-topic with examples
    topic-2.md       # Another independent topic
    topic-3.md       # Another independent topic
```

**Critical Structure Rules:**

1. **SKILL.md is an index/guide**
   - Brief "When to use" section
   - List of topics with links to rules/*.md
   - NO detailed documentation here
   - Just navigation and overview

2. **rules/*.md files are focused**
   - Each file covers ONE specific topic
   - Include concrete code examples
   - Self-contained (can be read independently)
   - Clear, descriptive filenames

3. **Benefits:**
   - Claude loads only relevant sections (faster)
   - Easier to maintain and update
   - Better organization and discoverability
   - User can reference specific topics
   - Modular and scalable

### Real Example: remotion-best-practices

**Structure:**
```
remotion-best-practices/
  SKILL.md                        # Index with links
  rules/
    animations.md                 # Animation patterns
    audio.md                      # Audio handling
    fonts.md                      # Font loading
    videos.md                     # Video embedding
    ... (40+ focused topics)
```

**SKILL.md content (simplified):**
```markdown
---
name: remotion-best-practices
description: Best practices for Remotion - Video creation in React
---

## When to use
Use when dealing with Remotion code.

## How to use
Read individual rule files:
- [rules/animations.md](rules/animations.md) - Animation patterns
- [rules/audio.md](rules/audio.md) - Audio handling
- [rules/fonts.md](rules/fonts.md) - Font loading
```

**rules/animations.md content (simplified):**
```markdown
---
name: animations
description: Fundamental animation skills for Remotion
---

All animations MUST be driven by `useCurrentFrame()` hook.

```tsx
import { useCurrentFrame } from "remotion";

export const FadeIn = () => {
  const frame = useCurrentFrame();
  // ... animation code
};
```

CSS transitions are FORBIDDEN.
```

**Why this works:**
- SKILL.md is a table of contents (easy to scan)
- Each rules/*.md is self-contained
- User can link to specific rules
- Claude loads only what's needed

## Template for New Skill

```markdown
---
name: your-skill-name
description: Use when [specific context or task]. Helps with [specific problem].
user_invocable: true
metadata:
  tags: relevant, keywords, here
---

## When to use

Use this skill when:
- [Specific criterion 1]
- [Specific criterion 2]
- [Specific criterion 3]

## Instructions

### Step 1: [Action Name]

[Clear instructions with examples]

### Step 2: [Action Name]

[Clear instructions with examples]

## Success Criteria

The skill was executed successfully when:
- [ ] [Verifiable criterion 1]
- [ ] [Verifiable criterion 2]
- [ ] [Verifiable criterion 3]

## Output Format

[Explicit description of expected output format]

Example:
```
[Show exact format expected]
```

## Constraints

- ❌ Never [anti-pattern]
- ✅ Always [best practice]

## Examples

### Example 1: [Use Case Name]

**Context**: [When you'd use this]

**Input**:
```
[Example input]
```

**Expected Output**:
```
[Example output]
```

**Explanation**: [Why this works]

## Uncertainty Handling

If you encounter [ambiguous situation], ask the user about [specific clarification needed].

## References

- [Official docs link]
- [Related skill or resource]
```

## Reference Documentation

### Claude Code Official Docs
- Skills format: https://docs.anthropic.com/en/docs/agents/skills
- User-invocable skills: Skills with `user_invocable: true` can be called via `/skill-name`
- Auto-loaded skills: Claude loads skills automatically based on `description` context matching

### Cursor Documentation
- Commands: https://docs.cursor.com/context/rules
- `.cursorrules` file in project root
- `.cursor/commands/` folder for multiple commands

## Common Skill Patterns

### Code Generation Skill

Focus on:
- Input format (what user provides)
- Output structure (exact code format)
- Conventions (naming, style)
- Dependencies (imports, packages)

### Analysis Skill

Focus on:
- What to analyze
- Output format (report structure)
- Metrics or criteria
- Actionable recommendations

### Teaching/Explanation Skill

Focus on:
- Analogies and metaphors
- Progressive examples (simple → complex)
- Common pitfalls
- Practice exercises

### Refactoring Skill

Focus on:
- Detection criteria (when to refactor)
- Step-by-step transformation
- Before/after examples
- Verification (tests still pass)

## Skill Quality Checklist

Before finalizing a skill, verify:

- [ ] **Name**: kebab-case, descriptive, unique
- [ ] **Description**: Helps Claude decide when to load
- [ ] **When to use**: Specific, verifiable criteria
- [ ] **Instructions**: Clear, actionable, step-by-step
- [ ] **Examples**: At least 2 concrete examples with input/output
- [ ] **Success Criteria**: Verifiable checkboxes
- [ ] **Constraints**: Explicit anti-patterns listed
- [ ] **Output Format**: Clearly defined with example
- [ ] **Uncertainty Handling**: Guidance on when to ask questions
- [ ] **Tags**: Relevant keywords for discoverability

## How to Create a New Skill

### Step 1: Identify the Need and Scope

Ask yourself:
- What specific task or problem does this solve?
- Is it a single focused task or a complex domain?
- Would documentation be > 300 lines? → Use multi-file
- Does it cover multiple independent topics? → Use multi-file

**Decision:**
- **Single file**: Focused task, < 200 lines, one workflow
- **Multi-file**: Complex domain, multiple topics, > 300 lines

### Step 2: Research Existing Patterns

- Check `.claude/skills/` for similar skills
- Review official documentation for the domain
- Look at `remotion-best-practices` as reference for multi-file structure
- Identify common patterns and anti-patterns

### Step 3: Plan Structure (CRITICAL for complex skills)

**If multi-file (recommended):**

1. **List all topics/sub-domains**
   - Break down into independent, focused topics
   - Each topic should be self-contained
   - Aim for 5-20 topics (like remotion has 40+)

2. **Create file structure:**
   ```
   skill-name/
     SKILL.md           # Index only
     rules/
       topic1.md
       topic2.md
       ...
   ```

3. **SKILL.md is just an index:**
   - When to use (brief)
   - List of links to rules/*.md
   - NO detailed documentation

4. **Each rules/*.md file:**
   - Focuses on ONE topic
   - Has YAML frontmatter with name/description
   - Includes concrete examples
   - Lists constraints and anti-patterns
   - Self-contained (readable independently)

### Step 4: Write Content

**For SKILL.md (index):**
```markdown
---
name: skill-name
description: Brief description
user_invocable: true
---

## When to use
[Brief criteria]

## How to use
Read individual rule files:
- [rules/topic1.md](rules/topic1.md) - Topic 1 description
- [rules/topic2.md](rules/topic2.md) - Topic 2 description
```

**For each rules/*.md:**
```markdown
---
name: topic-name
description: What this topic covers
metadata:
  tags: relevant, tags
---

[Focused content with examples and constraints]

## Examples
[Concrete code examples]

## Constraints
- ❌ Forbidden patterns
- ✅ Required patterns
```

### Step 5: Test the Skill

- Invoke manually: `/your-skill-name`
- Ask Claude to explain a specific topic
- Verify Claude references the correct rules/*.md file
- Check that examples work
- Refine based on usage

### Step 6: Iterate and Maintain

- Add new rules/*.md files as needed
- Update SKILL.md index with new links
- Keep each rule focused and independent
- Update examples with real-world usage

## Examples of Well-Crafted Skills

### Example 1: Multi-file Skill (RECOMMENDED PATTERN)

**Skill**: `react-hooks-guide`

**Directory structure:**
```
react-hooks-guide/
  SKILL.md
  rules/
    useState.md
    useEffect.md
    useContext.md
    custom-hooks.md
```

**SKILL.md (index only):**
```markdown
---
name: react-hooks-guide
description: Use when working with React Hooks. Comprehensive guide for useState, useEffect, useContext, and custom hooks.
user_invocable: true
metadata:
  tags: react, hooks, useState, useEffect, useContext
---

## When to use

Use this skill when:
- Working with React Hooks
- Need examples or best practices for hooks
- Creating custom hooks

## How to use

Read individual rule files for detailed guidance:

- [rules/useState.md](rules/useState.md) - State management with useState hook
- [rules/useEffect.md](rules/useEffect.md) - Side effects and lifecycle with useEffect
- [rules/useContext.md](rules/useContext.md) - Context API and useContext
- [rules/custom-hooks.md](rules/custom-hooks.md) - Creating reusable custom hooks
```

**rules/useState.md (focused topic):**
```markdown
---
name: useState
description: State management with useState hook
metadata:
  tags: react, hooks, useState, state
---

## When to use

Use `useState` when you need to add state to a functional component.

## Basic Usage

```tsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  );
}
```

## Best Practices

✅ **Use functional updates for dependent state:**
```tsx
setCount(prev => prev + 1);  // Good
setCount(count + 1);          // Avoid (stale closures)
```

✅ **Initialize with function for expensive computations:**
```tsx
const [value, setValue] = useState(() => expensiveCalculation());
```

## Constraints

- ❌ Never mutate state directly: `count = count + 1`
- ❌ Don't call setState in render (causes infinite loop)
- ✅ Always use setter function from useState
- ✅ Use functional updates when new state depends on old state

## Common Patterns

### Multiple State Variables
```tsx
const [name, setName] = useState('');
const [age, setAge] = useState(0);
```

### Object State
```tsx
const [user, setUser] = useState({ name: '', email: '' });

// Update specific field
setUser(prev => ({ ...prev, name: 'John' }));
```

### Array State
```tsx
const [items, setItems] = useState([]);

// Add item
setItems(prev => [...prev, newItem]);

// Remove item
setItems(prev => prev.filter(item => item.id !== id));
```
```

**Why this works:**
- SKILL.md is scannable index
- Each rule is focused and independent
- Easy to add new hooks (just add rules/newHook.md and link it)
- Claude loads only relevant rules

### Example 2: remotion-best-practices (Real-world Reference)
- **Structure**: Multi-file with 40+ rules/*.md files
- **Strength**: Comprehensive, each topic isolated
- **Pattern**: Domain-specific knowledge repository
- **Reference**: Check `.claude/skills/remotion-best-practices/` to see this pattern in action

### Example 3: Simple Single-file Skill

**Skill**: Code Documentation Skill

```markdown
---
name: add-jsdoc-comments
description: Use when adding JSDoc/docstring documentation to undocumented functions. Follows JSDoc 3 standards.
user_invocable: true
metadata:
  tags: documentation, jsdoc, comments, typescript
---

## When to use

Use this skill when:
- Function lacks documentation
- Adding JSDoc to TypeScript/JavaScript code
- User requests documentation for specific function

## Instructions

1. **Analyze Function Signature**
   - Read function name, parameters, return type
   - Identify side effects or exceptions

2. **Write JSDoc Block**
   - Brief description (one line)
   - @param for each parameter with type and description
   - @returns with type and description
   - @throws if function can throw errors
   - @example with usage example

3. **Follow Conventions**
   - Use third-person present tense ("Calculates..." not "Calculate...")
   - Be specific about types even if TypeScript infers them
   - Include edge cases in description

## Success Criteria

- [ ] Every parameter documented with type and description
- [ ] Return value documented
- [ ] At least one usage example included
- [ ] Follows JSDoc 3 syntax

## Output Format

```typescript
/**
 * Calculates the sum of two numbers with validation.
 *
 * @param {number} a - The first number to add
 * @param {number} b - The second number to add
 * @returns {number} The sum of a and b
 * @throws {TypeError} If either parameter is not a number
 *
 * @example
 * const result = add(5, 3); // Returns 8
 *
 * @example
 * add("5", 3); // Throws TypeError
 */
function add(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both parameters must be numbers');
  }
  return a + b;
}
```

## Constraints

- ❌ Never use vague descriptions like "Does stuff"
- ❌ Don't omit parameter types
- ✅ Always include at least one example
- ✅ Document edge cases and error conditions

## Uncertainty Handling

If the function's purpose is unclear from the code, ask: "What is the intended behavior of this function? Are there any edge cases I should document?"
```

## Tips for Effective Skills

1. **⭐ Default to Multi-file Structure**: If documenting a framework, library, or complex domain, ALWAYS use SKILL.md + rules/*.md pattern. Keep SKILL.md as index only. This makes skills:
   - Faster to load (Claude loads only relevant rules)
   - Easier to maintain (update one rule file)
   - More discoverable (each rule is focused)
   - Scalable (add new rules without bloating main file)

2. **Be Specific**: "Generate React form" → "Generate React Hook Form with Zod validation and TypeScript"

3. **Show, Don't Tell**: Include concrete code examples, not just descriptions

4. **Think in Contexts**: When should Claude load this skill automatically?

5. **Iterate**: Start simple, improve based on actual usage

6. **Cross-reference**: Link to related skills and official docs (both in SKILL.md and individual rules/*.md files)

7. **Test Edge Cases**: What happens when input is unexpected?

8. **Make it Scannable**: Use headers, lists, checkboxes for easy reference

9. **One Topic Per Rule**: Each rules/*.md should cover ONE focused topic only

10. **Update Regularly**: Keep skills aligned with current best practices and framework versions
já e
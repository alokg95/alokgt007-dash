#!/usr/bin/env node
/**
 * Export Clawdbot Gateway data for dashboard
 * Outputs: data.json
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function exec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch (e) {
    return null;
  }
}

function execJSON(cmd) {
  const output = exec(cmd);
  if (!output) return null;
  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

// Gateway status
const gatewayStatus = exec('clawdbot gateway status 2>&1') || 'unknown';
const isRunning = gatewayStatus.includes('running') || gatewayStatus.includes('Gateway is up');

// Model status
const modelsOutput = exec('clawdbot models status 2>&1') || '';
const defaultModelMatch = modelsOutput.match(/Default\s*:\s*(.+)/);
const defaultModel = defaultModelMatch ? defaultModelMatch[1].trim() : 'unknown';
const fallbacksMatch = modelsOutput.match(/Fallbacks\s*\((\d+)\)\s*:\s*(.+)/);
const fallbacks = fallbacksMatch ? fallbacksMatch[2].trim() : 'none';

// Auth status
const authProviders = [];
const authLines = modelsOutput.split('\n').filter(line => line.trim().startsWith('- '));
for (const line of authLines) {
  const providerMatch = line.match(/^- (\w+)\s+effective=/);
  if (providerMatch) {
    authProviders.push(providerMatch[1]);
  }
}

// Sessions via clawdbot CLI (sessions list is a tool, not CLI - we'll use a workaround)
// Since we don't have direct CLI for sessions, we'll read the sessions directory
const agentDir = path.join(process.env.HOME, '.clawdbot/agents/main/sessions');
let sessions = [];
let activityLog = [];

if (fs.existsSync(agentDir)) {
  const files = fs.readdirSync(agentDir).filter(f => f.endsWith('.jsonl'));
  
  for (const file of files) {
    const filePath = path.join(agentDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    
    if (lines.length === 0) continue;
    
    // Parse session metadata
    let sessionId = file.replace('.jsonl', '');
    let sessionKey = 'unknown';
    let lastActivity = null;
    let totalTokens = 0;
    let model = 'unknown';
    
    // Collect recent activity (last 24h)
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const ts = entry.timestamp ? new Date(entry.timestamp).getTime() : null;
        
        // Extract session key from session event
        if (entry.type === 'session' && entry.sessionKey) {
          sessionKey = entry.sessionKey;
        }
        
        // Track model changes
        if (entry.type === 'model_change' && entry.modelId) {
          model = entry.modelId;
        }
        
        // Track last activity
        if (ts) lastActivity = ts;
        
        // Track token usage
        if (entry.usage?.totalTokens) totalTokens += entry.usage.totalTokens;
        
        // Activity log entries (last 24h only)
        if (ts && ts > oneDayAgo) {
          let summary = 'unknown event';
          let eventType = 'other';
          
          // Extract actual message from wrapped format
          const msg = entry.type === 'message' && entry.message ? entry.message : entry;
          
          // User messages (with secret redaction)
          if (msg.role === 'user') {
            let text = '';
            if (typeof msg.content === 'string') {
              text = msg.content;
            } else if (Array.isArray(msg.content)) {
              const textPart = msg.content.find(c => c.type === 'text');
              text = textPart ? textPart.text : '';
            }
            // Redact secrets
            text = text.replace(/ghp_[a-zA-Z0-9]{36}/g, '[GitHub token redacted]');
            text = text.replace(/sk-ant-[a-zA-Z0-9_-]{95,}/g, '[Anthropic key redacted]');
            text = text.replace(/xoxb-[0-9-]{30,}/g, '[Slack bot token redacted]');
            summary = text.substring(0, 80);
            eventType = 'user_message';
          }
          // Assistant messages
          else if (msg.role === 'assistant') {
            if (msg.content && Array.isArray(msg.content)) {
              const toolCalls = msg.content.filter(c => c.type === 'toolCall');
              if (toolCalls.length > 0) {
                summary = toolCalls.map(t => t.name).join(', ');
                eventType = 'tool_call';
              } else {
                const text = msg.content.find(c => c.type === 'text');
                summary = text ? text.text.substring(0, 80) : 'assistant response';
                eventType = 'assistant_message';
              }
            }
          }
          // Tool results
          else if (msg.role === 'toolResult') {
            summary = `${msg.toolName} result`;
            eventType = 'tool_call';
          }
          // System events
          else if (msg.kind === 'system' || entry.type === 'system') {
            summary = msg.text || msg.content || entry.type || 'system event';
            if (typeof summary === 'object') summary = JSON.stringify(summary).substring(0, 80);
            eventType = 'system';
          }
          
          activityLog.push({
            timestamp: ts,
            sessionKey: sessionKey !== 'unknown' ? sessionKey : sessionId.substring(0, 12),
            eventType,
            summary
          });
        }
      } catch (e) {
        // Skip invalid lines
      }
    }
    
    // Only add session if it has recent activity
    if (lastActivity && lastActivity > oneDayAgo) {
      sessions.push({
        key: sessionKey !== 'unknown' ? sessionKey : sessionId.substring(0, 12),
        model,
        totalTokens,
        lastActivity
      });
    }
  }
}

// Sort activity log by timestamp descending
activityLog.sort((a, b) => b.timestamp - a.timestamp);

// Build output
const data = {
  timestamp: Date.now(),
  gateway: {
    status: isRunning ? 'running' : 'stopped',
    model: {
      primary: defaultModel,
      fallbacks: fallbacks
    },
    auth: {
      providers: authProviders
    }
  },
  sessions,
  activityLog
};

// Write to data.json
const outputPath = path.join(__dirname, 'data.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

console.log(`Dashboard data exported to ${outputPath}`);

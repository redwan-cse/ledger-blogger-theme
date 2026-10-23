import { describe, it, expect } from 'vitest';
import {
  healAsciiBoxDiagram,
  healAsciiFlowchartChains,
  healTimelineDiagram,
  healAsciiHandshakeDiagram
} from '../../scripts/publish-from-drive.js';

describe('publish-diagram-healer', () => {
  describe('healAsciiBoxDiagram (Tabular Grid)', () => {
    it('converts multi-column comparison matrix inside ASCII box into an HTML table container', () => {
      const asciiBox = `+-----------------------------------------------------------------------------------------+
| KERBEROS DEFENSIVE PARADIGM SHIFT: DETECTION GAP                                        |
+-----------------------------------------------------------------------------------------+
| Attack Technique      KDC Event 4768      Policy Timestamps    PAC Integrity            |
| Golden Ticket (T1558)  MISSING (Anomaly)   Anomalous (10 Yrs)   Forged Synthetic        |
| Diamond Ticket (T1558) AUTHENTIC (Present) 100% Policy Compliant Modified Legit         |
| Sapphire Ticket (S4U)  AUTHENTIC (Present) Legitimate S4U PAC   Impersonated PAC        |
+-----------------------------------------------------------------------------------------+`;

      const result = healAsciiBoxDiagram(asciiBox);
      expect(result).toContain('<div class="table-container">');
      expect(result).toContain('<table>');
      expect(result).toContain('<caption><strong>KERBEROS DEFENSIVE PARADIGM SHIFT: DETECTION GAP</strong></caption>');
      expect(result).toContain('<th>Attack Technique</th>');
      expect(result).toContain('<th>KDC Event 4768</th>');
      expect(result).toContain('<th>Policy Timestamps</th>');
      expect(result).toContain('<th>PAC Integrity</th>');
      expect(result).toContain('<td>Golden Ticket (T1558)</td>');
      expect(result).toContain('<td>MISSING (Anomaly)</td>');
      expect(result).toContain('<td>Diamond Ticket (T1558)</td>');
      expect(result).toContain('<td>AUTHENTIC (Present)</td>');
      expect(result).toContain('<td>100% Policy Compliant</td>');
      expect(result).toContain('<td>Modified Legit</td>');
      expect(result).toContain('</table>');
      expect(result).toContain('</div>');
    });
  });

  describe('healAsciiFlowchartChains', () => {
    it('heals chained ASCII arrows with vertical branch connector into valid Mermaid flowchart', () => {
      const brokenDiagram = `graph TD
[Raw TGT Ticket] ---> AES256-CTS Decryption (krbtgt key) ---> [EncTicketPart ASN.1 Structure]
                                                                      |
                                                                      v
                                                           [AuthorizationData: MS-PAC]`;

      const healed = healAsciiFlowchartChains(brokenDiagram);
      expect(healed).toContain('graph TD');
      expect(healed).toContain('node_1["Raw TGT Ticket"] -->|"AES256-CTS Decryption (krbtgt key)"| node_2["EncTicketPart ASN.1 Structure"]');
      expect(healed).toContain('node_2 --> node_3["AuthorizationData: MS-PAC"]');
      expect(healed).not.toMatch(/^\s*\|\s*$/m);
      expect(healed).not.toMatch(/^\s*[vV]\s*$/m);
    });

    it('preserves valid standard Mermaid code untouched', () => {
      const validDiagram = `flowchart TD
    A["Node A"] --> B["Node B"]`;
      const result = healAsciiFlowchartChains(validDiagram);
      expect(result).toBe(validDiagram);
    });
  });

  describe('healTimelineDiagram', () => {
    it('converts ASCII Timeline blocks into valid Mermaid flowchart TD with subgraph', () => {
      const timelineInput = `Timeline: Double-KRBTGT Password Rotation
[Hour 0:00]  First KRBTGT Password Reset ---> Current Key becomes Previous Key
             Oldest Key permanently purged
[Hour 0-10]  Wait 10-12 Hours: Allow legitimate user TGTs to naturally expire
             Active Directory replication converges across all forest DCs
[Hour 12:00] Second KRBTGT Password Reset ---> First new key becomes Previous Key
             Compromised Key permanently eradicated from AD history`;

      const healed = healTimelineDiagram(timelineInput);
      expect(healed).toContain('flowchart TD');
      expect(healed).toContain('subgraph "Double-KRBTGT Password Rotation"');
      expect(healed).toContain('step_1["Hour 0:00<br/>First KRBTGT Password Reset &bull; Current Key becomes Previous Key<br/>Oldest Key permanently purged"]');
      expect(healed).toContain('step_2["Hour 0-10<br/>Wait 10-12 Hours: Allow legitimate user TGTs to naturally expire<br/>Active Directory replication converges across all forest DCs"]');
      expect(healed).toContain('step_3["Hour 12:00<br/>Second KRBTGT Password Reset &bull; First new key becomes Previous Key<br/>Compromised Key permanently eradicated from AD history"]');
      expect(healed).toContain('step_1 --> step_2');
      expect(healed).toContain('step_2 --> step_3');
      expect(healed).not.toContain('<b>');
      expect(healed).not.toContain('</b>');
    });

    it('returns raw text unchanged if not a timeline format', () => {
      const plainCode = 'console.log("hello world");';
      expect(healTimelineDiagram(plainCode)).toBe(plainCode);
    });
  });

  describe('healAsciiHandshakeDiagram (Multi-Participant & Unicode)', () => {
    it('heals 3-participant Unicode box-drawing Kerberos ladder into valid Mermaid sequenceDiagram', () => {
      const sampleUnicode = `Client (User or DC01$)                      Target Server (Web01$)                     KDC (Domain Controller)
       │                                              │                                           │
       ├── 1. TGS-REQ (Request ST for http/web01) ────┼──────────────────────────────────────────►│
       │                                              │                                           │
       │◄── 2. TGS-REP (OK-AS-DELEGATE Flag Set) ─────┼───────────────────────────────────────────┤
       │                                              │                                           │
       ├── 3. KRB_TGS_REQ (Request Forwarded TGT) ────┼──────────────────────────────────────────►│
       │                                              │                                           │
       │◄── 4. KRB_TGS_REP (Forwarded TGT) ───────────┼───────────────────────────────────────────┤
       │                                              │                                           │
       ├── 5. AP-REQ with KRB_CRED (Contains TGT) ───►│                                           │
       │                                              │ ── 6. Extracts TGT & Caches in LSASS      │
       │                                              │                                           │
       │                                              │ ── 7. Server Can Now Impersonate Client!  │`;

      const healed = healAsciiHandshakeDiagram(sampleUnicode);
      expect(healed).toContain('sequenceDiagram');
      expect(healed).toContain('autonumber');
      expect(healed).toContain('actor Client as Client (User or DC01$)');
      expect(healed).toContain('participant TargetServer as Target Server (Web01$)');
      expect(healed).toContain('participant KDC as KDC (Domain Controller)');
      expect(healed).toContain('Client->>KDC: TGS-REQ (Request ST for http/web01)');
      expect(healed).toContain('KDC-->>Client: TGS-REP (OK-AS-DELEGATE Flag Set)');
      expect(healed).toContain('Client->>KDC: KRB_TGS_REQ (Request Forwarded TGT)');
      expect(healed).toContain('KDC-->>Client: KRB_TGS_REP (Forwarded TGT)');
      expect(healed).toContain('Client->>TargetServer: AP-REQ with KRB_CRED (Contains TGT)');
      expect(healed).toContain('Note over TargetServer: Extracts TGT & Caches in LSASS');
      expect(healed).toContain('Note over TargetServer: Server Can Now Impersonate Client!');
    });

    it('heals 3-participant ASCII ladder into valid Mermaid sequenceDiagram', () => {
      const sampleAscii = `Client (User or DC01$)                Target Server (Web01$)                 KDC
|                                     |                                      |
|-- 1. TGS-REQ (Request ST for http/web01) --------------------------------->|
|                                     |                                      |
|<-- 2. TGS-REP (OK-AS-DELEGATE Flag Set) -----------------------------------|
|                                     |                                      |
|-- 3. KRB_TGS_REQ (Request Forwarded TGT) ---------------------------------->|
|                                     |                                      |
|<-- 4. KRB_TGS_REP (Forwarded TGT) ------------------------------------------|
|                                     |                                      |
|-- 5. AP-REQ with KRB_CRED (Contains TGT) ->|                               |
|                                     |-- 6. Extracts TGT & Caches in LSASS--|
|                                     |                                      |
|-- 7. Server Can Now Impersonate Client`;

      const healed = healAsciiHandshakeDiagram(sampleAscii);
      expect(healed).toContain('sequenceDiagram');
      expect(healed).toContain('autonumber');
      expect(healed).toContain('actor Client as Client (User or DC01$)');
      expect(healed).toContain('participant TargetServer as Target Server (Web01$)');
      expect(healed).toContain('participant KDC as KDC');
      expect(healed).toContain('Client->>KDC: TGS-REQ (Request ST for http/web01)');
      expect(healed).toContain('KDC-->>Client: TGS-REP (OK-AS-DELEGATE Flag Set)');
      expect(healed).toContain('Client->>TargetServer: AP-REQ with KRB_CRED (Contains TGT)');
    });

    it('heals 2-participant bracket handshake ladder correctly', () => {
      const sample2Part = `[Attacker Client]
|---> Initial SYN Packet to FGFM Daemon
|<--- SYN-ACK Response from Target
|---> Final ACK Handshake Complete
[Session Established]`;

      const healed = healAsciiHandshakeDiagram(sample2Part);
      expect(healed).toContain('sequenceDiagram');
      expect(healed).toContain('actor Client as Attacker Client');
      expect(healed).toContain('Client->>Server: Initial SYN Packet to FGFM Daemon');
      expect(healed).toContain('Server-->>Client: SYN-ACK Response from Target');
      expect(healed).toContain('Client->>Server: Final ACK Handshake Complete');
      expect(healed).toContain('Note over Client,Server: Session Established');
    });

    it('returns raw text unchanged when text is regular code or not a ladder diagram', () => {
      const code = 'const x = 42;\nconsole.log(x);';
      expect(healAsciiHandshakeDiagram(code)).toBe(code);
    });
  });
});

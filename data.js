// ═══════════════════════════════════════════════════
// DATA MODEL — Agile RM Q2 Transformation Dashboard
// ═══════════════════════════════════════════════════

const DATA = {
  members: [
    {id:'vadim',name:'Вадим',role:'Head of Agile Office',avatar:'В'},
    {id:'izzat',name:'Иззат',role:'Transformation Lead',avatar:'И'},
    {id:'konstantin',name:'Константин',role:'TL B2B',avatar:'К'},
    {id:'alexey',name:'Алексей',role:'CTO',avatar:'А'},
    {id:'oleg',name:'Олег',role:'CDO',avatar:'О'},
    {id:'valeria',name:'Валерия',role:'Agile Coach',avatar:'В'},
    {id:'tatyana',name:'Татьяна',role:'Fin Analytics Lead',avatar:'Т'},
    {id:'fatima',name:'Фатима',role:'HRBP',avatar:'Ф'},
    {id:'alexander',name:'Александр',role:'TL Platforms',avatar:'А'},
  ],

  streams: [
    {id:'strategy',name:'Strategy & Portfolio',icon:'🎯',color:'#8b5cf6'},
    {id:'product',name:'Product Management',icon:'📦',color:'#3b82f6'},
    {id:'tech',name:'Technology & Architecture',icon:'⚙️',color:'#06b6d4'},
    {id:'delivery',name:'Delivery Model',icon:'🚀',color:'#10b981'},
    {id:'data',name:'Data & Economics',icon:'📊',color:'#f59e0b'},
    {id:'cx',name:'Customer Experience',icon:'💎',color:'#ec4899'},
    {id:'hr',name:'HR & Culture',icon:'🤝',color:'#f97316'},
  ],

  sprints: [
    {id:1,name:'Sprint 1',start:'2026-03-31',end:'2026-04-13',weeks:[14,15]},
    {id:2,name:'Sprint 2',start:'2026-04-14',end:'2026-04-27',weeks:[16,17]},
    {id:3,name:'Sprint 3',start:'2026-04-28',end:'2026-05-11',weeks:[18,19]},
    {id:4,name:'Sprint 4',start:'2026-05-12',end:'2026-05-25',weeks:[20,21]},
    {id:5,name:'Sprint 5',start:'2026-05-26',end:'2026-06-08',weeks:[22,23]},
    {id:6,name:'Sprint 6',start:'2026-06-09',end:'2026-06-22',weeks:[24,25]},
    {id:7,name:'Sprint 7',start:'2026-06-23',end:'2026-06-30',weeks:[26,27]},
  ],

  initiatives: [
    // Strategy & Portfolio
    {id:'sp_agile_office',name:'Agile Office Setup',stream:'strategy',owner:'izzat',s1:1,s2:2,status:'done',progress:100},
    {id:'sp_portfolio_governance',name:'Portfolio Governance',stream:'strategy',owner:'izzat',s1:2,s2:4,status:'blocked',progress:40},
    {id:'sp_strategy_alignment',name:'Product & Strategy Alignment',stream:'strategy',owner:'izzat',s1:1,s2:3,status:'done',progress:100},
    {id:'sp_governance_maturity',name:'Governance Maturity',stream:'strategy',owner:'izzat',s1:3,s2:5,status:'in_progress',progress:50},
    {id:'sp_execution_control',name:'Execution Governance',stream:'strategy',owner:'izzat',s1:3,s2:6,status:'in_progress',progress:45},
    {id:'sp_quarter_cycle',name:'Quarterly Governance Cycle',stream:'strategy',owner:'izzat',s1:6,s2:7,status:'planned',progress:0},
    // Product Management
    {id:'i3',name:'PO Capability Building',stream:'product',owner:'valeria',s1:1,s2:5,status:'in_progress',progress:35},
    {id:'i4',name:'Product Backlog Standards',stream:'product',owner:'oleg',s1:3,s2:5,status:'planned',progress:0},
    // Technology & Architecture
    {id:'i5',name:'DevOps Foundation',stream:'tech',owner:'alexey',s1:2,s2:6,status:'in_progress',progress:25},
    {id:'i6',name:'Architecture Review Board',stream:'tech',owner:'alexey',s1:3,s2:5,status:'planned',progress:0},
    // Delivery Model
    {id:'i7',name:'Scrum Pilot Program',stream:'delivery',owner:'fatima',s1:1,s2:4,status:'in_progress',progress:55},
    {id:'i8',name:'Scaled Agile Framework',stream:'delivery',owner:'izzat',s1:4,s2:7,status:'planned',progress:0},
    // Data & Economics
    {id:'i9',name:'Agile Metrics Framework',stream:'data',owner:'alexander',s1:2,s2:5,status:'in_progress',progress:30},
    {id:'i10',name:'Lean Budgeting Model',stream:'data',owner:'alexander',s1:4,s2:6,status:'planned',progress:0},
    // Customer Experience
    {id:'i11',name:'Voice of Customer Integration',stream:'cx',owner:'tatyana',s1:2,s2:5,status:'in_progress',progress:40},
    // HR & Culture
    {id:'i12',name:'Agile Role Transformation',stream:'hr',owner:'vadim',s1:1,s2:4,status:'in_progress',progress:50},
    {id:'i13',name:'Change Management Program',stream:'hr',owner:'tatyana',s1:1,s2:7,status:'in_progress',progress:30},
  ],

tasks: [],
};

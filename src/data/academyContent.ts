import { AcademyArticle } from '../types';

export const ACADEMY_ARTICLES: AcademyArticle[] = [
  {
    id: 'anatomia-opcoes-b3',
    category: 'Fundamentos B3',
    title: 'Anatomia e Nomenclatura das Opções na B3',
    readingMinutes: 6,
    subtitle: 'Entenda os códigos, letras de vencimento, a regra da 3ª sexta-feira e a armadilha dos números de strike.',
    keyTakeaways: [
      'Calls usam as letras A a L; Puts usam as letras M a X (de Janeiro a Dezembro).',
      'Desde maio de 2021, o vencimento oficial na B3 ocorre na 3ª sexta-feira de cada mês.',
      'O número no final do ticker NÃO representa necessariamente o strike exato (ex: PETRJ385 pode ter strike de R$ 38,20 após ajustes de dividendos).',
      'O exercício automático na B3 ocorre para qualquer opção ITM por mais de R$ 0,01, a menos que o titular ordene o contrário expressamente.',
    ],
    content: `
### 1. A Estrutura dos Tickers na B3
No mercado brasileiro, as opções de ações possuem um código padronizado composto por:
- **4 Primeiras Letras:** O código do ativo-objeto (ex: **PETR** para Petrobras, **VALE** para Vale, **BOVA** para o ETF do Ibovespa).
- **5ª Letra:** O mês de vencimento e o tipo de opção (CALL ou PUT).
- **Dígitos Finais:** O indicativo numérico do strike de lançamento (atenção: este número é apenas uma referência histórica).

#### Tabela de Letras de Vencimento da B3:
| Mês | CALL (Opção de Compra) | PUT (Opção de Venda) |
| :--- | :---: | :---: |
| **Janeiro** | **A** | **M** |
| **Fevereiro** | **B** | **N** |
| **Março** | **C** | **O** |
| **Abril** | **D** | **P** |
| **Maio** | **E** | **Q** |
| **Junho** | **F** | **R** |
| **Julho** | **G** | **S** |
| **Agosto** | **H** | **T** |
| **Setembro** | **I** | **U** |
| **Outubro** | **J** | **V** |
| **Novembro** | **K** | **W** |
| **Dezembro** | **L** | **X** |

---

### 2. A Armadilha dos Números de Strike
Um dos erros mais comuns de iniciantes na B3 é assumir que o ticker \`VALEJ650\` tem strike exato de R$ 65,00. 
Quando a empresa distribui proventos (dividendos ou juros sobre capital próprio - JCP), a B3 desconta o valor do provento **diretamente de todos os strikes das opções daquele ativo**! 
Portanto, após um dividendo de R$ 1,80, a opção \`VALEJ650\` passa a ter strike oficial de R$ 63,20, mesmo mantendo o mesmo ticker.
> **Regra de Ouro:** Sempre consulte o strike oficial atualizado no home broker da sua corretora ou no site oficial da B3 antes de enviar qualquer ordem!

---

### 3. Calendário de Vencimento e Exercício Automático
- **Data de Vencimento:** Ocorre na **3ª sexta-feira do mês**. Caso seja feriado nacional na B3, o vencimento antecipa para o dia útil anterior.
- **Exercício Automático:** A B3 adota o sistema de exercício automático para posições que fecharem no dinheiro (ITM) por uma margem mínima de R$ 0,01. Se você for o titular e a opção fechar ITM, a corretora e a câmara B3 exercerão a opção automaticamente às 18h00.
`,
    practicalExample: 'Se você estiver vendido em PETRJ385 (strike R$ 38,50) e a Petrobras fechar a 3ª sexta-feira cotada a R$ 38,51, você será compulsoriamente exercido e obrigado a vender suas ações por R$ 38,50.'
  },
  {
    id: 'estilo-exercicio-b3',
    category: 'Mecânica Operacional',
    title: 'Estilo Americano vs Europeu: A Singularidade do Brasil',
    readingMinutes: 7,
    subtitle: 'Por que Calls de Petrobras e Vale são americanas, enquanto quase todas as Puts são européias.',
    keyTakeaways: [
      'Opções Americanas podem ser exercidas pelo titular a qualquer dia útil até o vencimento.',
      'Opções Européias só podem ser exercidas estritamente no dia do vencimento.',
      'Na B3, quase a totalidade das CALLs líquidas são Americanas e as PUTs são Européias.',
      'O risco de exercício antecipado (Early Assignment) afeta quem vendeu CALLs ITM, especialmente em vésperas de "Data Com" de dividendos.',
    ],
    content: `
### 1. A Divisão Curiosa do Mercado Brasileiro
Enquanto na maioria dos mercados de derivativos de ações no mundo predomina o estilo Americano tanto para Calls quanto para Puts, a B3 possui uma característica singular:
- **CALLs sobre ações:** Quase 100% são de **Estilo Americano**.
- **PUTs sobre ações:** Praticamente 100% são de **Estilo Europeu** (com raras exceções históricas).
- **Opções sobre o Índice Bovespa (BOVA11 e Ibov):** São prioritariamente Européias com liquidação financeira.

---

### 2. O Risco de Exercício Antecipado de CALLs (Dividend Capture)
Se você realizou uma venda coberta de CALL em PETR4 ou VALE3 e a opção ficou profundamente no dinheiro (Deep ITM), o titular pode exercer o direito de compra **antes do vencimento**. 
O momento de maior risco de exercício antecipado ocorre **na véspera da Data-Com de um dividendo volumoso**:
1. Quem tem a opção de compra NÃO recebe dividendos; apenas quem tem a ação física em custódia tem direito ao provento.
2. Se o valor extrínseco (prêmio de tempo) da CALL for menor do que o dividendo por ação que será pago no dia seguinte, os grandes investidores e tesourarias institucionais **exercem a CALL antecipadamente** para capturar o dividendo na ação!
3. Se você era o lançador vendido, a B3 fará o sorteio e você terá suas ações retiradas da custódia pelo strike, perdendo o direito ao dividendo.

---

### 3. A Grande Vantagem das PUTs Européias para o Lançador
Para quem vende PUT com garantia de caixa na B3 (estratégia de renda ou The Wheel), o fato de serem européias é uma **enorme bênção**:
- O lançador da PUT sabe que **não pode ser exercido antecipadamente**, mesmo que a ação despenque 20% no início do mês!
- Isso dá ao trader tempo hábil total até a 3ª sexta-feira para que o papel se recupere, permitindo colher todo o decaimento do tempo (Theta) sem medo de ser stopado no meio do caminho por exercício surpresa.
`,
    practicalExample: 'Se você vendeu VALEV600 (PUT strike 60) e a Vale cai para R$ 56 na primeira semana, você NÃO será exercido no dia seguinte. Você tem até o 3º vencimento mensal para rolar a posição ou aguardar um repique.'
  },
  {
    id: 'impacto-selic-rho',
    category: 'Macro & Modelagem',
    title: 'A Selic Alta e a Distorção do Rho nas Opções Brasileiras',
    readingMinutes: 8,
    subtitle: 'Como juros de 10% a 14% a.a. alteram profundamente o valor justo de Calls e Puts em relação aos EUA.',
    keyTakeaways: [
      'O Rho mede a sensibilidade do preço da opção em relação à taxa de juros livre de risco.',
      'No Brasil, a taxa Selic/CDI elevada atua encarecendo as CALLs e barateando as PUTs.',
      'Carregar posições compradas em opções no Brasil tem um custo de oportunidade implícito muito maior do que nos mercados desenvolvidos.',
      'O Box de 4 pontas é amplamente utilizado por bancos na B3 para captar e emprestar a CDI sintético.',
    ],
    content: `
### 1. O Modelo Black-Scholes em Ambiente de Juros Elevados
Nos Estados Unidos e Europa, a literatura clássica de opções muitas vezes ignora a grega **Rho** (taxa de juros), porque historicamente os juros lá orbitavam entre 0% e 3% a.a. 
No Brasil, a realidade é oposta: com a Selic frequentemente em dois dígitos (10% a 14% a.a.), **a taxa de juros é um dos fatores mais determinantes na precificação das opções**.

Na fórmula de paridade Put-Call:
$$\\text{Call} - \\text{Put} = S - K \\cdot e^{-r \\cdot T}$$

Onde $r$ é a taxa de juros do CDI/Selic. Quanto maior a taxa $r$:
- O valor presente do strike a ser pago no futuro ($K \\cdot e^{-r \\cdot T}$) diminui bastante.
- **As CALLs ficam muito mais caras** do que seriam em um ambiente de juros baixos.
- **As PUTs ficam estruturalmente mais baratas**, sofrendo desconto financeiro pela postergação do recebimento do capital.

---

### 2. A Venda de Opções com Juros Embutidos
Quando você vende uma CALL OTM em uma operação de Venda Coberta no Brasil, você não está vendendo apenas volatilidade e tempo: você está vendendo **o carrego da taxa de juros brasileira** embutida no prêmio!
Por outro lado, quem fica comprado a seco em opções no Brasil perde duplamente:
1. Perde o decaimento do tempo diário (Theta).
2. Perde o rendimento da taxa Selic que seu dinheiro estaria gerando livre de risco no Tesouro Direto ou no CDI (Custo de Oportunidade).

---

### 3. A Estratégia de Sintéticos e Box de 4 Pontas
Instituições financeiras brasileiras utilizam a estrutura de **Box Spread** (compra de trava de alta com call + compra de trava de baixa com put nos mesmos strikes) para travar um fluxo de caixa fixo no vencimento, criando um empréstimo ou aplicação a uma taxa muito próxima de 100% a 103% do CDI, sem qualquer exposição direcional à bolsa.
`,
    practicalExample: 'Uma CALL de 3 meses para frente na B3 tem um "prêmio de juros" de cerca de 2,5% a 3,5% do valor da ação apenas pelo efeito do CDI durante o período de carregamento.'
  },
  {
    id: 'gregas-na-b3',
    category: 'Quantitativo',
    title: 'As Gregas na Prática do Mercado B3: DU 252 e o Efeito Fim de Semana',
    readingMinutes: 9,
    subtitle: 'Delta, Gamma, Theta em dias úteis, Vega e como o tempo é precificado entre sexta e segunda-feira.',
    keyTakeaways: [
      'Delta: Indica a sensibilidade ao preço do ativo e a probabilidade teórica aproximada de ficar no dinheiro.',
      'Gamma: Mede a aceleração do Delta; torna-se explosivo e perigoso para opções ATM na semana do vencimento.',
      'Theta B3: É calculado sobre a base de 252 Dias Úteis (DU), não 365 dias corridos.',
      'O mito da venda na sexta para colher no sábado/domingo: market makers na B3 já precificam o fim de semana na tarde de sexta-feira.',
      'Vega: Mede a sensibilidade a cada 1 ponto percentual de oscilação na Volatilidade Implícita (IV).',
    ],
    content: `
### 1. Delta: A Bússola do Direcionamento
O Delta varia de 0 a 1.00 para CALLs e de 0 a -1.00 para PUTs:
- **Delta 0.50 (ATM):** A opção se move R$ 0,50 para cada R$ 1,00 que a ação andar.
- **Delta como Probabilidade:** Um Delta de 0.20 significa que a opção tem aproximadamente 20% de probabilidade teórica de expirar no dinheiro. Traders de venda coberta e venda de put frequentemente escolhem deltas entre 0.15 e 0.30 para maximizar a taxa de acerto.

---

### 2. Gamma: O Acelerador e o Risco de Ruína
O Gamma mede a velocidade com que o Delta se altera. 
- O Gamma atinge seu ponto máximo para opções **ATM (no dinheiro)** quando faltam poucos dias para o vencimento.
- **Perigo Mortal:** Se você estiver vendido a seco em uma opção ATM na semana da 3ª sexta-feira, qualquer movimento de 1% do ativo faz seu prejuízo dobrar ou triplicar instantaneamente devido ao Gamma extremo.
> **Regra de Defesa:** Nunca carregue posições vendidas ATM para a última semana do vencimento. Faça o desmonte ou a rolagem antes!

---

### 3. Theta e a Convenção de 252 Dias Úteis (DU)
Na B3, a convenção padrão de precificação de derivativos não usa 365 dias, mas sim **252 dias úteis**.
Isso gera um efeito fascinante no mercado brasileiro:
- **O Efeito Final de Semana:** Muitos investidores acreditam que vender opções na sexta-feira às 16h50 permite "ganhar o Theta de sábado e domingo de graça".
- **A Realidade:** Os robôs e formadores de mercado (Market Makers) da B3 começam a precificar a passagem dos dias não-úteis já a partir das 14h00 da sexta-feira! Portanto, o prêmio da opção já sofre erosão antes do fechamento do pregão.

---

### 4. Vega e o Efeito "IV Crush"
O Vega mede quanto o prêmio da opção sobe ou desce para cada variação de 1% na volatilidade implícita.
- **Em momentos de euforia ou pânico:** O IV dispara, inflando os prêmios de todas as opções (momento propício para estratégias vendedoras como Iron Condor e Travas de Crédito).
- **No dia seguinte a um grande evento (balanço ou eleição):** Ocorre o violento **IV Crush** (colapso da volatilidade implícita), onde mesmo que a ação suba, uma CALL comprada pode desvalorizar porque o Vega esvaziou o valor extrínseco.
`,
    practicalExample: 'Se uma opção tem Vega de R$ 0,25 e a volatilidade implícita de PETR4 despenca de 38% para 28% (-10 pontos) após a divulgação dos resultados, a opção perderá R$ 2,50 de valor extrínseco apenas pelo choque de volatilidade.'
  },
  {
    id: 'sistema-core-margem',
    category: 'Gestão de Risco',
    title: 'Sistema de Margem CORE B3 & Gestão de Garantias',
    readingMinutes: 8,
    subtitle: 'Como a câmara B3 calcula o risco dinâmico, chamadas de margem e deságios de garantias.',
    keyTakeaways: [
      'O sistema CORE (Closeout Risk Evaluation) é o motor de cálculo de risco multi-ativo da câmara B3.',
      'Venda Coberta de CALL tem margem zero em dinheiro, pois as ações em custódia garantem 100% do risco.',
      'A B3 aceita Tesouro Direto Selic, CDBs com liquidez e ações com diferentes tabelas de deságio (haircut).',
      'Travas de spread (duas pernas) possuem margem reduzida e travada na diferença dos strikes.',
      'A chamada de margem ocorre no intradia e na liquidação em D+1; falha na cobertura gera liquidação compulsória e multas pesadas.',
    ],
    content: `
### 1. O que é o Sistema CORE B3?
O **CORE** (Calculation of Risk in Electronic Environment) é o sistema proprietário da B3 que avalia o risco de todas as posições em derivativos, ações e empréstimos em tempo real.
Diferente de fórmulas estáticas antigas, o CORE calcula o custo de liquidação da carteira do investidor em centenas de cenários de estresse simultâneos (variação combinada de preço à vista, volatilidade e juros).

---

### 2. Hierarquia de Exigência de Margem por Operação
1. **Posição Titular Comprada (Calls/Puts compradas):** 
   - Exigência de margem: **ZERO**. O risco máximo é apenas o valor desembolsado para comprar a opção em D+1.
2. **Venda Coberta (Covered Call):** 
   - Exigência de margem em dinheiro: **ZERO**. A corretora aloca as ações do próprio investidor como garantia estrita. As ações ficam bloqueadas para venda enquanto a opção estiver aberta.
3. **Travas Direcionais (Bull/Bear Spreads):** 
   - Exigência de margem: **Travada no risco máximo da estrutura**. A B3 reconhece a ponta comprada e exige apenas a diferença entre os strikes menos o crédito.
4. **Venda a Seco (Naked Short Call/Put):** 
   - Exigência de margem: **MÁXIMA e DINÂMICA**. A B3 pode exigir entre 20% e 40% do valor nocional total das ações, com aumento imediato se a ação se mover contra você.

---

### 3. Tabela de Deságios de Garantias Aceitas na B3
Para operar vendido gerando renda, você não precisa deixar dinheiro parado na conta corrente da corretora:
- **Tesouro Selic (LFT):** Excelente garantia. Deságio de apenas 1% a 2% do valor de face.
- **CDBs de Liquidez Diária de Bancos Autorizados:** Geralmente aceitos com deságio de 5% a 10%.
- **Ações da Carteira do Ibovespa:** Aceitas com deságios regulamentares de 15% a 35% dependendo da liquidez do papel.
- **Tesouro IPCA+ (NTN-B):** Aceito com deságio maior devido à marcação a mercado do título longo.
`,
    practicalExample: 'Com R$ 50.000 aplicados no Tesouro Selic rendendo 100% do CDI, você pode alocar cerca de R$ 48.000 como garantia na B3 para vender PUTs OTM e receber prêmios mensais sem abrir mão do rendimento da renda fixa.'
  },
  {
    id: 'manual-rolagem-manejo',
    category: 'Estratégia & Manejo',
    title: 'Manual Tático de Rolagem e Defesa de Posições na B3',
    readingMinutes: 10,
    subtitle: 'As regras de ouro da rolagem: quando vale a pena rolar e quando aceitar o prejuízo para proteger a carteira.',
    keyTakeaways: [
      'Rolagem consiste em recomprar a opção da série atual e vender simultaneamente uma opção da série seguinte.',
      'Regra Cardeal: A rolagem deve SEMPRE gerar CRÉDITO LÍQUIDO financeiro. Nunca pague débito para rolar!',
      'Rolagem no Tempo: Mantém o mesmo strike para capturar mais valor de tempo.',
      'Rolagem Defensiva: Ajusta o strike para longe do perigo (subindo strike de Call ou descendo strike de Put) reduzindo ligeiramente a quantidade.',
      'Definir stop loss antecipado evita carregar "posições zumbis" que drenam margem da corretora.',
    ],
    content: `
### 1. O que é a Rolagem de Opções?
A rolagem é o mecanismo pelo qual um lançador de opções evita ser exercido ou compra tempo adicional para que a tese da operação se concretize.
Ela é executada através de uma ordem combinada:
1. **Perna 1:** Recompra da opção que está vendida na série atual (exemplo: recompra de \`PETRJ385\` de outubro).
2. **Perna 2:** Venda da opção da série seguinte (exemplo: venda de \`PETRK385\` ou \`PETRK390\` de novembro).

---

### 2. As 4 Regras de Ouro da Rolagem Saudável
#### Regra 1: Sempre com Crédito Líquido
Se para rolar para o mês seguinte você tiver que pagar dinheiro do bolso (débito), **NÃO ROLE**. Pagar para rolar transforma uma perda contida em um buraco financeiro cumulativo. Só role se a venda da nova série pagar a recompra da série atual com sobra na conta.

#### Regra 2: Rolagem Preventiva (Não espere a 3ª sexta-feira)
O melhor momento para rolar uma opção ameaçada é quando o ativo atinge o strike (ficou ATM), geralmente faltando 7 a 12 dias úteis para o vencimento. Se esperar as 14h00 da sexta-feira do vencimento, o prêmio da opção vendida terá apenas valor intrínseco e a rolagem para crédito será inviável.

#### Regra 3: Rolagem com Ajuste de Strike (Subindo ou Descendo)
Se você fez venda coberta de CALL no strike R$ 38,00 e o papel foi para R$ 40,00:
- Tente rolar para o mês seguinte no strike R$ 39,00 ou R$ 40,00. 
- Caso o prêmio do strike superior não seja suficiente para dar crédito, reduza em 10% a 15% o número de opções vendidas (ex: recompra 1.000 da série atual e vende 850 ou 900 da nova série no strike mais alto).

#### Regra 4: O Momento de Aceitar o Exercício
Em operações de Venda Coberta, ser exercido com lucro máximo **é o objetivo de sucesso da estratégia**, não uma derrota! Se o papel subiu muito, entregue as ações no strike acordado, embolse o lucro do capital mais o prêmio recebido, e reinicie o ciclo através da venda de PUT no The Wheel.
`,
    practicalExample: 'Recomprar 1.000 PETRJ380 a R$ 1,40 e simultaneamente vender 1.000 PETRK390 a R$ 1,65 gera um crédito líquido de R$ 0,25 por ação (R$ 250 no bolso) e ainda ganha R$ 1,00 a mais de espaço de alta na ação física.'
  },
  {
    id: 'tributacao-ir-opcoes',
    category: 'Fiscal & Compliance',
    title: 'Tributação e Imposto de Renda em Opções na B3',
    readingMinutes: 7,
    subtitle: 'Alíquotas de 15% e 20%, regras do DARF 6015, e o mito perigoso da isenção de R$ 20 mil reais.',
    keyTakeaways: [
      'Alíquota de 15% sobre o lucro líquido em operações normais (Swing Trade).',
      'Alíquota de 20% sobre o lucro líquido em operações encerradas no mesmo dia (Day Trade).',
      'NÃO EXISTE isenção de R$ 20.000 para opções! Qualquer R$ 1,00 de lucro líquido deve ser tributado.',
      'Prejuízos acumulados em opções podem ser compensados indefinidamente com lucros futuros na mesma modalidade (swing ou day trade).',
      'O pagamento do DARF (código 6015) deve ser realizado até o último dia útil do mês subsequente ao da operação.',
    ],
    content: `
### 1. O Mito da Isenção dos R$ 20 Mil
Um dos erros que mais geram multas na malha fina da Receita Federal:
> **A isenção mensal de R$ 20.000 de vendas aplica-se EXCLUSIVAMENTE ao mercado de ações à vista.**
> Para opções, contratos futuros e derivativos, **NÃO HÁ ISENÇÃO**. Se você obteve um lucro líquido de R$ 200 no mês com opções, é obrigatório calcular e recolher o imposto via DARF.

---

### 2. Alíquotas e Modalidades
- **Swing Trade (operações iniciadas em um dia e fechadas em outro):** Alíquota de **15%** sobre o ganho líquido.
- **Day Trade (compra e venda no mesmo dia):** Alíquota de **20%** sobre o ganho líquido.
- **Dedução de Custos:** Da base de cálculo do lucro, você tem o direito legal de abater todas as taxas operacionais (corretagem, emolumentos B3, taxa de registro e ISS da corretora).

---

### 3. Compensação de Prejuízos
Se você teve prejuízo de R$ 3.000 no mês de agosto com opções, você NÃO paga imposto naquele mês. 
Além disso, você pode carregar esse prejuízo para os meses seguintes:
- Se em setembro você lucrar R$ 2.000, você abate do saldo negativo acumulado (restando R$ 1.000 de prejuízo a compensar) e paga ZERO de imposto.
- **Regra:** Prejuízos de Swing Trade só abatem lucros de Swing Trade. Prejuízos de Day Trade só abatem lucros de Day Trade.

---

### 4. Como Emitir o DARF
1. Some todas as notas de corretagem do mês e deduza os custos operacionais e prejuízos anteriores.
2. Aplique a alíquota (15% ou 20%).
3. Deduza o "dedo-duro" (IRRF retido na fonte pela corretora).
4. Emita o DARF pelo SicalcWeb no site da Receita Federal com o código **6015** (Ganhos Líquidos em Operações em Bolsa).
5. Pague até o último dia útil do mês seguinte.
`,
    practicalExample: 'Se você lucrou R$ 1.000 em operações de venda coberta e pagou R$ 30 de emolumentos B3, seu lucro tributável é R$ 970. O imposto de 15% será de R$ 145,50, menos eventuais centavos de IRRF retidos pela corretora.'
  },
  {
    id: 'glossario-jargoes',
    category: 'Dicionário & Termos',
    title: 'Glossário Prático de Derivativos do Mercado Brasileiro',
    readingMinutes: 6,
    subtitle: 'Moneyness, Smile, Skew, Taxa do Papel, e o jargão do pregão da B3 decodificado.',
    keyTakeaways: [
      'ITM (In the Money): Opção no dinheiro com valor intrínseco.',
      'ATM (At the Money): Opção com strike colado no preço à vista.',
      'OTM (Out of the Money): Opção fora do dinheiro composta 100% de valor extrínseco.',
      'Skew de Volatilidade: As Puts na B3 costumam ter IV mais alto que as Calls devido à demanda por proteção institucional.',
      'Taxa do Papel: O percentual de prêmio capturado na Venda Coberta em relação ao preço da ação.',
    ],
    content: `
### Dicionário de Termos Essenciais da B3

- **ITM (In The Money / Dentro do Dinheiro):** Opção que possui valor intrínseco. Para uma CALL, é quando o strike é menor que o preço da ação. Para uma PUT, é quando o strike é maior que o preço da ação.
- **ATM (At The Money / No Dinheiro):** Opção cujo strike está praticamente igual ao preço à vista do ativo no pregão. Possui a maior densidade de valor extrínseco e maior liquidez de negociação.
- **OTM (Out of The Money / Fora do Dinheiro):** Opção sem valor intrínseco. Vale apenas pela probabilidade de tempo até o vencimento. Se o vencimento ocorresse hoje, expiraria valendo R$ 0,00.
- **Valor Intrínseco (VI):** O lucro imediato se a opção fosse exercida neste exato segundo (ex: ação a R$ 35, CALL strike R$ 30 tem VI de R$ 5,00).
- **Valor Extrínseco (VE / Prêmio de Tempo):** O preço total da opção menos o seu valor intrínseco. É a parcela que o tempo (Theta) corrói dia após dia até zerar na 3ª sexta-feira.
- **Volatilidade Implícita (IV):** A volatilidade esperada pelo mercado para o ativo futuro, embutida no preço atual da opção através do modelo de Black-Scholes.
- **Skew de Volatilidade (Vol Skew):** Na B3, as PUTs OTM quase sempre negociam com volatilidade implícita mais alta do que as CALLs OTM, porque os fundos institucionais pagam prêmios mais altos para comprar seguro de carteira.
- **Exercício Compulsório:** Quando a posição vendida é exercida pela câmara B3 e as ações ou dinheiro são debitados da conta da corretora.
- **Virar Pó:** Quando a opção expira sem valor na data de vencimento. Meta principal dos investidores vendedores de opções.
`,
    practicalExample: 'Dizer que uma PETRJ380 com ação a R$ 39,00 cotada a R$ 1,40 possui R$ 1,00 de Valor Intrínseco e R$ 0,40 de Valor Extrínseco (taxa de tempo pura).'
  }
];

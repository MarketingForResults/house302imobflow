# Matriz de acesso - ImobFlow

Este documento delimita o comportamento esperado por perfil quando o acesso ao sistema ou app for liberado. A regra principal e: cada perfil externo enxerga somente registros vinculados ao proprio cadastro, contrato, imovel ou atendimento.

## Administrador master

- Visualiza e opera todos os modulos.
- Cria, revoga e reenvia acessos.
- Pode aplicar descontos comerciais em reais ou percentual.
- Revisa vistorias, documentos, propostas, contratos, pagamentos e cadastros externos.
- Acessa relatorios, configuracoes, usuarios, logs e integracoes.

## Gerente / operador interno

- Visualiza e opera imoveis, clientes, corretores, parceiros, vistorias, documentos, alugueis e vendas.
- Nao gerencia usuarios master nem configuracoes sensiveis.
- Pode apoiar o envio de documentos e acompanhar chamados.
- Descontos comerciais devem depender de permissao administrativa.

## Financeiro

- Visualiza contratos, parcelas, recibos, extratos e relatorios financeiros.
- Opera baixas, recibos, devolucoes, reajustes e acompanhamento de inadimplencia.
- Nao altera captacao tecnica do imovel, usuarios, regras institucionais ou modelos juridicos sem permissao.

## Corretor

- Visualiza seus clientes, imoveis, propostas, contratos e documentos vinculados.
- Acompanha chamados e ocorrencias dos seus clientes.
- Visualiza extratos de alugueis e honorarios vinculados.
- Pode anexar documentos de atendimento e registrar historicos.
- Nao acessa clientes, imoveis, contratos ou dados financeiros sem vinculo.

## Proprietario

- Acessa portal/app com documentos, contratos, recibos e historico de pagamentos dos seus imoveis.
- Acompanha propostas, analise de contrato, vistorias, chamados e andamento de manutencao.
- Atualiza dados cadastrais e envia documentos solicitados.
- Nao visualiza dados de outros proprietarios, inquilinos sem contrato vinculado ou operacao interna.

## Inquilino

- Acessa portal/app com andamento de proposta, contrato, vistorias, agendamentos, parcelas, extratos e recibos vinculados.
- Abre chamados e ocorrencias do contrato ativo.
- Atualiza dados cadastrais e envia documentos solicitados.
- Cadastra fiador com dados pessoais, endereco, comprovantes de renda e contatos de referencia.
- Nao visualiza dados do proprietario alem do necessario no contrato, nem operacao interna.

## Parceiro indicador

- Usa formulario publico curto para cadastro e indicacao.
- Depois de aprovado, pode acompanhar status das oportunidades indicadas e bonificacoes, se o portal de parceiro estiver habilitado.
- Nao acessa CRM operacional, dados financeiros amplos ou contratos sem vinculo.

## Regras tecnicas recomendadas

- Aplicar RLS por vinculo: `owner_id`, `tenant_id`, `buyer_id`, `seller_id`, `broker_id`, `partner_id`, `property_id` e `contract_id`.
- Toda tabela exposta ao portal deve ter politica explicita para `authenticated` e filtros por usuario vinculado.
- Downloads de arquivos devem validar o mesmo vinculo da entidade dona do documento.
- Convites devem manter alternativa manual com link copiavel e mensagem pronta para WhatsApp.
- Logs futuros devem registrar usuario, perfil, inicio de sessao, duracao, IP aproximado, acao executada e entidade afetada.

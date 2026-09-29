def create_minimalist_checklist():
    from docx import Document
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn
    from docx.oxml import OxmlElement
    doc = Document()
    
    # --- Configuração de Estilo (Minimalista/Moderno) ---
    # Define a fonte padrão como Segoe UI (comum em UIs modernas) ou Arial
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Segoe UI'
    font.size = Pt(10)
    font.color.rgb = RGBColor(51, 51, 51)  # Cinza Escuro (#333) para suavidade

    # --- Título Principal ---
    title_paragraph = doc.add_paragraph()
    title_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = title_paragraph.add_run("CHECKLIST OPERACIONAL | AUTO EQUITY PJ")
    run.bold = True
    run.font.size = Pt(18)
    run.font.color.rgb = RGBColor(0, 51, 102)  # Azul Escuro Profundo
    
    # Subtítulo (Protocolo)
    sub_title = doc.add_paragraph()
    sub_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run_sub = sub_title.add_run("Protocolo: _______________   Data: ____/____/_______   Analista: ___________________")
    run_sub.font.size = Pt(10)
    run_sub.font.color.rgb = RGBColor(128, 128, 128) # Cinza médio
    
    doc.add_paragraph("") # Espaço

    # --- Função Auxiliar para Criar Seções com Tabelas Invisíveis ---
    def add_section(header_text, description, items):
        # Cabeçalho da Seção com Design Clean (Espaçamento e Cor)
        h = doc.add_paragraph()
        run_h = h.add_run(header_text)
        run_h.bold = True
        run_h.font.size = Pt(14)
        run_h.font.color.rgb = RGBColor(40, 40, 40) # Cinza Chumbo
        
        # Descrição da Seção
        d = doc.add_paragraph(description)
        d.style.font.italic = True
        d.style.font.size = Pt(9)
        d.style.font.color.rgb = RGBColor(100, 100, 100)
        
        # Tabela Invisível (Layout)
        table = doc.add_table(rows=0, cols=3)
        table.style = 'Normal Table' # Remove bordas padrão
        table.autofit = False
        
        # Ajuste de largura das colunas
        # Col 1: Checkbox (5%), Col 2: Item (35%), Col 3: Detalhes (60%)
        # Largura total página A4 ~ 6.5 polegadas de margem
        
        for item_name, item_detail in items:
            row_cells = table.add_row().cells
            
            # Célula 1: Checkbox (Simulação visual ou Controle de Conteúdo)
            # Usando caractere unicode para caixa vazia
            p0 = row_cells[0].paragraphs[0]
            run0 = p0.add_run("\u2610") # ☐
            run0.font.size = Pt(14)
            run0.font.color.rgb = RGBColor(0, 102, 204) # Azul destaque

            # Célula 2: Nome do Documento
            p1 = row_cells[1].paragraphs[0]
            run1 = p1.add_run(item_name)
            run1.bold = True

            # Célula 3: Detalhes Técnicos
            p2 = row_cells[2].paragraphs[0]
            run2 = p2.add_run(item_detail)
            run2.font.size = Pt(9)
            run2.font.color.rgb = RGBColor(100, 100, 100)

            # Ajuste de largura manual (aproximado)
            row_cells[0].width = Inches(0.5)
            row_cells[1].width = Inches(2.5)
            row_cells[2].width = Inches(3.5)
            
            # Adiciona um pequeno espaçamento entre linhas se necessário
            p1.paragraph_format.space_after = Pt(6)

        doc.add_paragraph("") # Espaço entre seções

    # --- Conteúdo do Relatório ---

    # Seção 1
    items_s1 = [
        ("Contrato Social", "Última alteração consolidada"),
        ("Certificado de CNPJ", "Atualizado"),
        ("Comprovante de Endereço", "Emitido há menos de 3 meses"),
        ("Certidão Negativa de Débitos", "Federal, Estadual e Municipal"),
        ("Balanço Patrimonial", "Últimos 2 exercícios"),
        ("DRE (Demonstrativo de Resultados)", "Últimos 2 exercícios")
    ]
    add_section("01. DADOS DA EMPRESA (TOMADORA)", "Preencher com os dados da Pessoa Jurídica solicitante.", items_s1)

    # Seção 2
    items_s2 = [
        ("RG e CPF dos Sócios", "Cópias autenticadas"),
        ("Comprovante de Residência", "Emitido há menos de 3 meses"),
        ("Certidão de Casamento", "Se aplicável"),
        ("Procuração", "Para representação legal"),
        ("Comprovante de Renda", "Últimos 3 meses")
    ]
    add_section("02. SÓCIOS E REPRESENTANTES", "Documentação de todas as pessoas físicas vinculadas à operação.", items_s2)

    # Seção 3
    items_s3 = [
        ("CRV (Certificado de Registro de Veículo)", "Original"),
        ("Laudo de Avaliação", "Realizado por empresa credenciada"),
        ("Seguro do Veículo", "Em nome da empresa"),
        ("Comprovante de IPVA", "Quitado"),
        ("Comprovante de Multas", "Quitadas ou parceladas")
    ]
    add_section("03. GARANTIA (VEÍCULO)", "Verificação técnica e legal do bem a ser alienado.", items_s3)

    # Seção 4
    items_s4 = [
        ("Comprovante Bancário", "Conta corrente em nome da empresa"),
        ("Dados para Transferência", "Agência, conta e favorecido"),
        ("Telefone de Contato", "Responsável pela operação"),
        ("E-mail", "Para comunicação")
    ]
    add_section("04. DADOS BANCÁRIOS E CONTATO", "Para desembolso do crédito.", items_s4)

    # Rodapé
    footer = doc.sections[0].footer
    p = footer.paragraphs
    p.text = "Documento confidencial - Parte integrante do dossiê de crédito Auto Equity."
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.style.font.size = Pt(8)
    p.style.font.color.rgb = RGBColor(150, 150, 150)

    # Salvar
    file_name = "Checklist_Auto_Equity_Minimalista.docx"
    doc.save(file_name)
    print(f"Arquivo '{file_name}' criado com sucesso!")

if __name__ == "__main__":
    try:
        create_minimalist_checklist()
    except ImportError:
        print("Erro: A biblioteca 'python-docx' não está instalada.")
        print("Instale usando: pip install python-docx")
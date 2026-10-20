let
    Fonte = Json.Document(
        Web.Contents(
            "https://controle-backoffice-arii.fabiodasilvaa82.workers.dev/api/power-bi/production"
        )
    ),
    Tabela = Table.FromRecords(Fonte),
    Tipos = Table.TransformColumnTypes(
        Tabela,
        {
            {"id", Int64.Type},
            {"attendantEmail", type text},
            {"attendantName", type text},
            {"employeeCode", type text},
            {"type", type text},
            {"protocol", type text},
            {"outcome", type text},
            {"typology", type text},
            {"state", type text},
            {"quantity", Int64.Type},
            {"durationSeconds", Int64.Type},
            {"productiveSeconds", Int64.Type},
            {"occurredAt", type datetime},
            {"date", type date},
            {"time", type time}
        }
    ),
    Nomes = Table.RenameColumns(
        Tipos,
        {
            {"attendantEmail", "E-mail do atendente"},
            {"attendantName", "Atendente"},
            {"employeeCode", "Matrícula"},
            {"type", "Tipo"},
            {"protocol", "Protocolo"},
            {"outcome", "Parecer"},
            {"typology", "Tipologia"},
            {"state", "Estado"},
            {"quantity", "Quantidade"},
            {"durationSeconds", "Segundos por atividade"},
            {"productiveSeconds", "Segundos produtivos"},
            {"occurredAt", "Data e hora"},
            {"date", "Data"},
            {"time", "Hora"}
        }
    )
in
    Nomes

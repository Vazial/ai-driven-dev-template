package reservation.acceptance.dsl;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 応答ボディをAPI仕様(reservation-api.yaml)のスキーマと機械照合する(ADR-0007)。
 * フィールドの過不足・型だけを機械的に検査する。値の意味の妥当性(期待値との一致)は
 * 各DSLメソッドのassertが個別に検証する — 「形」と「意味」の検証責務を分離する。
 *
 * <p>スタックに追加依存(rest-assuredのjson-schema-validator等)が無いため、
 * OpenAPIのschemaオブジェクトをJavaの値として最小限に写し取り、照合器として使う。
 * 依存追加が必要な範囲まで要件が育った場合はorchestratorへのエスカレーション対象。
 */
public final class JsonSchemaAssertions {

    private JsonSchemaAssertions() {
    }

    /** スキーマ上の1フィールドを表す。 */
    public sealed interface Field permits ScalarField, ArrayOfObjectsField {
        String name();
    }

    /** 文字列などスカラー型の必須フィールド。 */
    public record ScalarField(String name, Class<?> javaType) implements Field {
    }

    /** ネストしたオブジェクトの配列である必須フィールド(要素はitemSchemaに従う)。 */
    public record ArrayOfObjectsField(String name, List<Field> itemSchema) implements Field {
    }

    /**
     * 応答ボディ(JsonPath#getMapで得たMap)が、スキーマの必須フィールドと過不足なく一致し、
     * 各フィールドの型が仕様通りであることを検証する。
     */
    public static void assertMatchesSchema(String context, Map<String, ?> body, List<Field> schema) {
        Set<String> expectedNames = schema.stream().map(Field::name).collect(Collectors.toSet());
        assertThat(body.keySet()).as("%s: フィールドの過不足", context).isEqualTo(expectedNames);
        schema.forEach(field -> assertField(context, body, field));
    }

    private static void assertField(String context, Map<String, ?> body, Field field) {
        Object value = body.get(field.name());
        assertThat(value).as("%s: %s は必須", context, field.name()).isNotNull();
        if (field instanceof ScalarField scalar) {
            assertThat(value).as("%s: %s の型", context, field.name()).isInstanceOf(scalar.javaType());
        } else if (field instanceof ArrayOfObjectsField array) {
            assertThat(value).as("%s: %s は配列であるべき", context, field.name()).isInstanceOf(List.class);
            assertArrayItems(context, field.name(), (List<?>) value, array.itemSchema());
        }
    }

    private static void assertArrayItems(String context, String fieldName, List<?> items, List<Field> itemSchema) {
        for (int i = 0; i < items.size(); i++) {
            Object item = items.get(i);
            assertThat(item).as("%s: %s[%d] はオブジェクトであるべき", context, fieldName, i).isInstanceOf(Map.class);
            assertMatchesSchema("%s.%s[%d]".formatted(context, fieldName, i), (Map<String, ?>) item, itemSchema);
        }
    }
}

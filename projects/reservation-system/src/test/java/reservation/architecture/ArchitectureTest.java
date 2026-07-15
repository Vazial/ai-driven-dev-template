package reservation.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.springframework.context.annotation.Profile;

/**
 * L2: 構造の健全性(design.md モジュール境界)。
 * 依存方向 adapter → application → domain の一方向を機械強制する。
 */
@AnalyzeClasses(packages = "reservation", importOptions = ImportOption.DoNotIncludeTests.class)
public class ArchitectureTest {

    /** domainはフレームワーク(Spring/JPA)と他層を知らない。 */
    @ArchTest
    static final ArchRule domain_is_framework_and_layer_independent =
            noClasses().that().resideInAPackage("reservation.domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "reservation.application..",
                            "reservation.adapter..",
                            "org.springframework..",
                            "jakarta..",
                            "javax..");

    /** applicationはadapterに依存しない(逆流禁止)。 */
    @ArchTest
    static final ArchRule application_does_not_depend_on_adapter =
            noClasses().that().resideInAPackage("reservation.application..")
                    .should().dependOnClassesThat().resideInAnyPackage("reservation.adapter..");

    /** 層の一方向性: adapter → application → domain。 */
    @ArchTest
    static final ArchRule layers_are_one_directional =
            layeredArchitecture().consideringOnlyDependenciesInLayers()
                    .layer("adapter").definedBy("reservation.adapter..")
                    .layer("application").definedBy("reservation.application..")
                    .layer("domain").definedBy("reservation.domain..")
                    .whereLayer("adapter").mayNotBeAccessedByAnyLayer()
                    .whereLayer("application").mayOnlyBeAccessedByLayers("adapter")
                    .whereLayer("domain").mayOnlyBeAccessedByLayers("adapter", "application");

    /** 受け入れテスト用seamは本番構成に存在してはならない(design.md: プロファイルacceptance限定)。 */
    @ArchTest
    static final ArchRule test_support_is_profile_gated =
            classes().that().haveSimpleNameStartingWith("TestSupport")
                    .should().beAnnotatedWith(Profile.class)
                    .because("test-support seamはSpringプロファイルacceptance限定でなければならない");
}

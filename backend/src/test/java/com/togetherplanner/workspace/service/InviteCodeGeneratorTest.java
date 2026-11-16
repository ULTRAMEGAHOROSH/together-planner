package com.togetherplanner.workspace.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/** spec §14.2. */
class InviteCodeGeneratorTest {

    private final InviteCodeGenerator generator = new InviteCodeGenerator();

    @Test
    void generatedCodeIsEightCharactersFromTheAlphabet() {
        String code = generator.generate();
        assertThat(code).hasSize(8);
        assertThat(code).matches("[23456789ABCDEFGHJKMNPQRSTVWXYZ]{8}");
    }

    @Test
    void normalizeStripsHyphenAndSpacesAndUppercases() {
        assertThat(InviteCodeGenerator.normalize("k7qm-2xpa")).isEqualTo("K7QM2XPA");
    }

    @Test
    void toDisplayCodeInsertsHyphenAfterFourthCharacter() {
        assertThat(InviteCodeGenerator.toDisplayCode("K7QM2XPA")).isEqualTo("K7QM-2XPA");
    }
}

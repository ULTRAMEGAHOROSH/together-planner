package com.togetherplanner.user;

import com.togetherplanner.testsupport.AbstractIntegrationTest;
import com.togetherplanner.user.entity.User;
import com.togetherplanner.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class UserRepositoryIT extends AbstractIntegrationTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void savesAndFindsByEmail() {
        userRepository.save(new User("alice@example.com", "Alice", "hash", clock.instant()));

        assertThat(userRepository.findByEmail("alice@example.com")).isPresent();
        assertThat(userRepository.findByEmail("nobody@example.com")).isEmpty();
    }

    @Test
    void uppercaseEmailViolatesLowercaseCheckConstraint() {
        User user = new User("ALICE@EXAMPLE.COM", "Alice", "hash", clock.instant());

        assertThatThrownBy(() -> userRepository.saveAndFlush(user))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}

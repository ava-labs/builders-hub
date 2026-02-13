import json

with open('/Users/nicolas.arnedo/builders-hub/.quiz-gen/batch_3_output.json') as f:
    data = json.load(f)

total = 0
multi = 0
single = 0
dist = {0: 0, 1: 0, 2: 0, 3: 0}

for qid in sorted(data.keys(), key=lambda x: int(x)):
    for i, alt in enumerate(data[qid]):
        total += 1
        ca = alt['correctAnswers']
        if len(ca) > 1:
            multi += 1
            assert len(ca) == 2, f"{qid}[{i}] has {len(ca)} correct answers"
        else:
            single += 1
            dist[ca[0]] += 1

print(f"Total alternates: {total}")
print(f"Multi-answer: {multi} (target: 23)")
print(f"Single-answer: {single} (target: 67)")
print(f"\nSingle-answer distribution:")
print(f"  [0]: {dist[0]} (target: ~17)")
print(f"  [1]: {dist[1]} (target: ~17)")
print(f"  [2]: {dist[2]} (target: ~17)")
print(f"  [3]: {dist[3]} (target: ~16)")
print(f"\nQuiz IDs: {len(data)}")

for qid in data:
    assert len(data[qid]) == 2, f"Quiz {qid} has {len(data[qid])} alternates"

short_correct_count = 0
for qid in sorted(data.keys(), key=lambda x: int(x)):
    for i, alt in enumerate(data[qid]):
        ca = alt['correctAnswers']
        option_lens = [len(o) for o in alt['options']]
        avg_len = sum(option_lens) / len(option_lens)
        correct_lens = [option_lens[j] for j in ca]
        if all(cl < avg_len for cl in correct_lens):
            short_correct_count += 1

print(f"\nQuestions where ALL correct answers are shorter than average: {short_correct_count}/90 (target: ~36 = 40%)")

short_single = 0
for qid in sorted(data.keys(), key=lambda x: int(x)):
    for i, alt in enumerate(data[qid]):
        ca = alt['correctAnswers']
        if len(ca) == 1:
            option_lens = [len(o) for o in alt['options']]
            correct_len = option_lens[ca[0]]
            sorted_lens = sorted(option_lens)
            if correct_len <= sorted_lens[1]:
                short_single += 1

print(f"Single-answer questions where correct is in shorter half: {short_single}/67")

for qid, alts in data.items():
    for i, alt in enumerate(alts):
        assert 'question' in alt, f'Quiz {qid} alt {i} missing question'
        assert 'options' in alt, f'Quiz {qid} alt {i} missing options'
        assert len(alt['options']) == 4, f'Quiz {qid} alt {i} has {len(alt["options"])} options'
        assert 'correctAnswers' in alt, f'Quiz {qid} alt {i} missing correctAnswers'
        assert 'hint' in alt, f'Quiz {qid} alt {i} missing hint'
        assert 'explanation' in alt, f'Quiz {qid} alt {i} missing explanation'
        for ca_val in alt['correctAnswers']:
            assert 0 <= ca_val <= 3, f'Quiz {qid} alt {i} has invalid correctAnswer {ca_val}'

print("\nAll structural validations passed!")
